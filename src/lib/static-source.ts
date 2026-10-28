import type Database from "better-sqlite3";
import { z } from "zod";
import {
  sourceVersionStore,
  SourceVersionError,
  type SourceVersion,
  type SourceFile,
} from "./versions";
import {
  ArtifactValidationError,
  validateFiles,
  buildPreview,
} from "./static-artifact";

export type SourceOperationErrorCode =
  | "unavailable"
  | "conflict"
  | "invalid_request"
  | "invalid_output"
  | "unsupported_source"
  | "source_limit";

export class SourceOperationError extends Error {
  constructor(public readonly code: SourceOperationErrorCode) {
    super(code);
    this.name = "SourceOperationError";
  }
}

const saveInput = z
  .object({
    baseVersionId: z.uuid().nullable(),
    files: z
      .array(z.object({ path: z.string(), content: z.string() }).strict())
      .length(2),
  })
  .strict();
const restoreInput = z
  .object({
    baseVersionId: z.uuid().nullable(),
    versionId: z.uuid(),
  })
  .strict();

function requireStaticSnapshot(files: SourceFile[]) {
  if (files.length === 0) return;
  const paths = new Set(files.map((file) => file.path));
  if (
    files.length !== 2 ||
    paths.size !== 2 ||
    !paths.has("index.html") ||
    !paths.has("styles.css")
  ) {
    throw new SourceOperationError("unsupported_source");
  }
}

function convertError(error: unknown): never {
  if (error instanceof SourceOperationError) throw error;
  if (error instanceof ArtifactValidationError)
    throw new SourceOperationError("invalid_output");
  if (error instanceof z.ZodError)
    throw new SourceOperationError("invalid_request");
  if (error instanceof SourceVersionError) {
    const codes: Record<SourceVersionError["code"], SourceOperationErrorCode> =
      {
        NOT_FOUND: "unavailable",
        CONFLICT: "conflict",
        LIMIT: "source_limit",
        INVALID_CHANGE: "invalid_output",
        INVALID_PATH: "invalid_output",
      };
    throw new SourceOperationError(codes[error.code]);
  }
  throw error;
}

/** Manual static edits never call a model or execute source. Every save appends history. */
export function staticSourceStore(db: Database.Database) {
  const sources = sourceVersionStore(db);
  function transaction(operation: () => SourceVersion): SourceVersion {
    try {
      return db.transaction(operation).immediate();
    } catch (error) {
      return convertError(error);
    }
  }
  return {
    save(owner: string, projectId: string, input: unknown): SourceVersion {
      return transaction(() => {
        // Ownership precedes input validation; hold the same write transaction
        // while checking source shape and performing the canonical base check.
        const current = sources.latest(owner, projectId);
        const parsed = saveInput.parse(input);
        requireStaticSnapshot(current?.files || []);
        const files = validateFiles(parsed.files);
        buildPreview(files);
        return sources.commit(owner, projectId, {
          baseVersionId: parsed.baseVersionId,
          summary: current ? "Edit static source" : "Create static source",
          changes: files.map((file) => ({ type: "write", ...file })),
        });
      });
    },
    restore(owner: string, projectId: string, input: unknown): SourceVersion {
      return transaction(() => {
        const current = sources.latest(owner, projectId);
        const parsed = restoreInput.parse(input);
        requireStaticSnapshot(current?.files || []);
        const target = sources.get(owner, projectId, parsed.versionId);
        requireStaticSnapshot(target.files);
        const files = validateFiles(target.files);
        buildPreview(files);
        return sources.restore(owner, projectId, {
          ...parsed,
          summary: `Restore static version ${target.number}`,
        });
      });
    },
  };
}
