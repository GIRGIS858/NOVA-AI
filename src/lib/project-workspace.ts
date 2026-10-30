import type Database from "better-sqlite3";
import { z } from "zod";
import {
  sourceVersionStore,
  SourceVersionError,
  SOURCE_LIMITS,
  type SourceVersion,
} from "./versions";
import { FULLSTACK_TEMPLATE_FILES } from "./fullstack-template";
import { buildSourceZip } from "./source-zip";

export type WorkspaceErrorCode =
  | "unavailable"
  | "conflict"
  | "source_limit"
  | "invalid_request"
  | "invalid_path"
  | "invalid_change"
  | "unchanged";
export class WorkspaceError extends Error {
  constructor(public readonly code: WorkspaceErrorCode) {
    super(code);
    this.name = "WorkspaceError";
  }
}
// JSON control-character escaping may expand UTF-8 source to six bytes per byte.
export const WORKSPACE_REQUEST_BYTES =
  SOURCE_LIMITS.totalBytes * 6 + 256 * 1024;
const filesSchema = z
  .array(z.object({ path: z.string(), content: z.string() }).strict())
  .max(SOURCE_LIMITS.files);
const saveInput = z
  .object({ baseVersionId: z.uuid().nullable(), files: filesSchema })
  .strict();
const restoreInput = z
  .object({ baseVersionId: z.uuid().nullable(), versionId: z.uuid() })
  .strict();
const templateInput = z.object({ baseVersionId: z.null() }).strict();
const versionId = z.uuid();

function convertError(error: unknown): never {
  if (error instanceof WorkspaceError) throw error;
  if (error instanceof z.ZodError) {
    const sizeLimit = error.issues.some(
      (issue) =>
        issue.code === "too_big" &&
        issue.path[0] === "files" &&
        (issue.path.length === 1 || issue.path[2] === "content"),
    );
    throw new WorkspaceError(sizeLimit ? "source_limit" : "invalid_request");
  }
  if (error instanceof SourceVersionError) {
    const codes: Record<SourceVersionError["code"], WorkspaceErrorCode> = {
      NOT_FOUND: "unavailable",
      CONFLICT: "conflict",
      LIMIT: "source_limit",
      INVALID_PATH: "invalid_path",
      INVALID_CHANGE: "invalid_change",
    };
    throw new WorkspaceError(codes[error.code]);
  }
  throw error;
}

/** Text snapshots only: importing, executing, installing and previewing code are separate capabilities. */
export function projectWorkspaceStore(db: Database.Database) {
  const sources = sourceVersionStore(db);
  function transaction<T>(operation: () => T): T {
    try {
      return db.transaction(operation).immediate();
    } catch (error) {
      return convertError(error);
    }
  }
  return {
    read(owner: string, projectId: string, requested?: string) {
      return transaction(() => {
        const latest = sources.latest(owner, projectId);
        const version =
          requested === undefined
            ? latest
            : sources.get(owner, projectId, versionId.parse(requested));
        return {
          version,
          versions: sources.list(owner, projectId),
          latestVersionId: latest?.id || null,
          limits: SOURCE_LIMITS,
        };
      });
    },
    save(owner: string, projectId: string, input: unknown): SourceVersion {
      return transaction(() => {
        const current = sources.latest(owner, projectId);
        const parsed = saveInput.parse(input);
        if ((current?.id || null) !== parsed.baseVersionId)
          throw new WorkspaceError("conflict");
        const previous = new Map(
          (current?.files || []).map((file) => [file.path, file.content]),
        );
        if (
          previous.size === parsed.files.length &&
          new Set(parsed.files.map((file) => file.path)).size ===
            parsed.files.length &&
          parsed.files.every((file) => previous.get(file.path) === file.content)
        )
          throw new WorkspaceError("unchanged");
        return sources.replace(owner, projectId, {
          ...parsed,
          summary: current ? "Edit project files" : "Create project files",
        });
      });
    },
    restore(owner: string, projectId: string, input: unknown): SourceVersion {
      return transaction(() => {
        sources.latest(owner, projectId); // Ownership precedes parsing.
        const parsed = restoreInput.parse(input);
        const target = sources.get(owner, projectId, parsed.versionId);
        return sources.restore(owner, projectId, {
          ...parsed,
          summary: `Restore project version ${target.number}`,
        });
      });
    },
    template(owner: string, projectId: string, input: unknown): SourceVersion {
      return transaction(() => {
        const current = sources.latest(owner, projectId);
        templateInput.parse(input);
        if (current) throw new WorkspaceError("conflict");
        return sources.replace(owner, projectId, {
          baseVersionId: null,
          summary: "Create full-stack starter",
          files: FULLSTACK_TEMPLATE_FILES,
        });
      });
    },
    export(owner: string, projectId: string, requested: string) {
      return transaction(() => {
        sources.latest(owner, projectId);
        const version = sources.get(
          owner,
          projectId,
          versionId.parse(requested),
        );
        return { version, archive: buildSourceZip(version.files) };
      });
    },
  };
}
