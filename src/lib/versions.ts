import type Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import { z } from "zod";

export const SOURCE_LIMITS = Object.freeze({
  fileBytes: 256 * 1024,
  totalBytes: 2 * 1024 * 1024,
  files: 200,
  versions: 128,
});
const pathInput = z.string().min(1).max(240);
const changeInput = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("write"),
      path: pathInput,
      content: z.string().max(SOURCE_LIMITS.fileBytes),
    })
    .strict(),
  z.object({ type: z.literal("delete"), path: pathInput }).strict(),
]);
const commitInput = z
  .object({
    baseVersionId: z.string().uuid().nullable(),
    summary: z.string().trim().min(1).max(240),
    changes: z.array(changeInput).min(1).max(SOURCE_LIMITS.files),
  })
  .strict();
const restoreInput = z
  .object({
    baseVersionId: z.string().uuid().nullable(),
    versionId: z.string().uuid(),
    summary: z.string().trim().min(1).max(240),
  })
  .strict();

export type SourceFile = { path: string; content: string };
export type VersionInfo = {
  id: string;
  projectId: string;
  number: number;
  baseVersionId: string | null;
  restoredFrom: string | null;
  summary: string;
  createdAt: string;
  fileCount: number;
  totalBytes: number;
};
export type SourceVersion = VersionInfo & { files: SourceFile[] };
export class SourceVersionError extends Error {
  constructor(
    public readonly code:
      "NOT_FOUND" | "CONFLICT" | "INVALID_PATH" | "INVALID_CHANGE" | "LIMIT",
    message: string,
  ) {
    super(message);
    this.name = "SourceVersionError";
  }
}

/** Portable logical source paths only. Never interpret these as execution permission. */
export function validateSourcePath(value: string): string {
  const path = pathInput.parse(value);
  const segments = path.split("/");
  if (
    !/^[A-Za-z0-9_@()[\]./-]+$/.test(path) ||
    path.startsWith("/") ||
    segments.some(
      (s) =>
        !s ||
        s === "." ||
        s === ".." ||
        s.startsWith(".") ||
        s.endsWith(".") ||
        /^(con|prn|aux|nul|com[0-9]|lpt[0-9])(?:\.|$)/i.test(s),
    )
  ) {
    throw new SourceVersionError(
      "INVALID_PATH",
      "Use a relative, portable source-file path.",
    );
  }
  if (
    segments.some((s) =>
      /^(node_modules|vendor|secrets?|credentials?|data|dist|build|coverage)$/i.test(
        s,
      ),
    ) ||
    /(^|\/)(id_rsa|id_ed25519|server\.env|credentials\.json)$/i.test(path)
  ) {
    throw new SourceVersionError(
      "INVALID_PATH",
      "Reserved directories and credential files cannot be source files.",
    );
  }
  if (!/\.(tsx?|jsx?|mjs|cjs|css|scss|html|json|md|mdx|txt|svg)$/i.test(path)) {
    throw new SourceVersionError(
      "INVALID_PATH",
      "This source-file type is not supported.",
    );
  }
  return path;
}

export function migrateSourceVersions(db: Database.Database) {
  db.exec(`CREATE TABLE IF NOT EXISTS source_versions (
    id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    number INTEGER NOT NULL, base_version_id TEXT, restored_from TEXT, summary TEXT NOT NULL,
    created_at TEXT NOT NULL, file_count INTEGER NOT NULL, total_bytes INTEGER NOT NULL,
    files_json TEXT NOT NULL, UNIQUE(project_id, number)
  );`);
}

type Row = {
  id: string;
  project_id: string;
  number: number;
  base_version_id: string | null;
  restored_from: string | null;
  summary: string;
  created_at: string;
  file_count: number;
  total_bytes: number;
  files_json: string;
};
function info(row: Omit<Row, "files_json">): VersionInfo {
  return {
    id: row.id,
    projectId: row.project_id,
    number: row.number,
    baseVersionId: row.base_version_id,
    restoredFrom: row.restored_from,
    summary: row.summary,
    createdAt: row.created_at,
    fileCount: row.file_count,
    totalBytes: row.total_bytes,
  };
}
function version(row: Row): SourceVersion {
  return { ...info(row), files: JSON.parse(row.files_json) as SourceFile[] };
}

export function sourceVersionStore(db: Database.Database) {
  function authorize(owner: string, project: string) {
    if (
      !db
        .prepare("SELECT id FROM projects WHERE id = ? AND owner_id = ?")
        .get(project, owner)
    )
      throw new SourceVersionError("NOT_FOUND", "Project unavailable.");
  }
  function latest(project: string) {
    return db
      .prepare(
        "SELECT * FROM source_versions WHERE project_id = ? ORDER BY number DESC LIMIT 1",
      )
      .get(project) as Row | undefined;
  }
  function validateSnapshot(files: SourceFile[]) {
    if (files.length > SOURCE_LIMITS.files)
      throw new SourceVersionError("LIMIT", "Too many source files.");
    let total = 0;
    const names = new Set<string>();
    for (const file of files) {
      validateSourcePath(file.path);
      const canonical = file.path.toLowerCase();
      if (names.has(canonical))
        throw new SourceVersionError(
          "INVALID_CHANGE",
          "Paths must be unique, including letter case.",
        );
      names.add(canonical);
      const size = Buffer.byteLength(file.content, "utf8");
      if (file.content.includes("\0"))
        throw new SourceVersionError(
          "INVALID_CHANGE",
          "Only text source files are supported.",
        );
      if (size > SOURCE_LIMITS.fileBytes)
        throw new SourceVersionError(
          "LIMIT",
          "Source file exceeds the byte limit.",
        );
      total += size;
    }
    if (total > SOURCE_LIMITS.totalBytes)
      throw new SourceVersionError(
        "LIMIT",
        "Source snapshot exceeds the byte limit.",
      );
    return total;
  }
  function save(
    project: string,
    base: Row | undefined,
    files: SourceFile[],
    summary: string,
    restoredFrom: string | null = null,
  ) {
    if ((base?.number || 0) >= SOURCE_LIMITS.versions)
      throw new SourceVersionError(
        "LIMIT",
        "Project source history limit reached.",
      );
    const ordered = [...files].sort((a, b) =>
      a.path < b.path ? -1 : a.path > b.path ? 1 : 0,
    );
    const bytes = validateSnapshot(ordered);
    const next: SourceVersion = {
      id: randomUUID(),
      projectId: project,
      number: (base?.number || 0) + 1,
      baseVersionId: base?.id || null,
      restoredFrom,
      summary,
      createdAt: new Date().toISOString(),
      fileCount: ordered.length,
      totalBytes: bytes,
      files: ordered,
    };
    db.prepare(
      "INSERT INTO source_versions VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    ).run(
      next.id,
      project,
      next.number,
      next.baseVersionId,
      restoredFrom,
      summary,
      next.createdAt,
      next.fileCount,
      bytes,
      JSON.stringify(ordered),
    );
    db.prepare("UPDATE projects SET updated_at = ? WHERE id = ?").run(
      next.createdAt,
      project,
    );
    return next;
  }
  function checkBase(project: string, expected: string | null) {
    const current = latest(project);
    if ((current?.id || null) !== expected)
      throw new SourceVersionError(
        "CONFLICT",
        "The project changed. Reload its latest version before saving.",
      );
    return current;
  }
  return {
    list(owner: string, project: string): VersionInfo[] {
      authorize(owner, project);
      return (
        db
          .prepare(
            "SELECT id, project_id, number, base_version_id, restored_from, summary, created_at, file_count, total_bytes FROM source_versions WHERE project_id = ? ORDER BY number DESC",
          )
          .all(project) as Row[]
      ).map(info);
    },
    latest(owner: string, project: string): SourceVersion | null {
      authorize(owner, project);
      const row = latest(project);
      return row ? version(row) : null;
    },
    get(owner: string, project: string, id: string): SourceVersion {
      authorize(owner, project);
      const row = db
        .prepare(
          "SELECT * FROM source_versions WHERE project_id = ? AND id = ?",
        )
        .get(project, id) as Row | undefined;
      if (!row)
        throw new SourceVersionError("NOT_FOUND", "Version unavailable.");
      return version(row);
    },
    commit(owner: string, project: string, input: unknown): SourceVersion {
      authorize(owner, project);
      const parsed = commitInput.parse(input);
      return db
        .transaction(() => {
          authorize(owner, project);
          const current = checkBase(project, parsed.baseVersionId);
          const files = new Map(
            (current ? version(current).files : []).map((f) => [
              f.path,
              f.content,
            ]),
          );
          const touched = new Set<string>();
          for (const change of parsed.changes) {
            const path = validateSourcePath(change.path);
            if (touched.has(path.toLowerCase()))
              throw new SourceVersionError(
                "INVALID_CHANGE",
                "A file can be changed only once per version.",
              );
            touched.add(path.toLowerCase());
            if (change.type === "delete") {
              if (!files.delete(path))
                throw new SourceVersionError(
                  "INVALID_CHANGE",
                  "Cannot delete a file that does not exist.",
                );
            } else files.set(path, change.content);
          }
          return save(
            project,
            current,
            [...files].map(([path, content]) => ({ path, content })),
            parsed.summary,
          );
        })
        .immediate();
    },
    restore(owner: string, project: string, input: unknown): SourceVersion {
      authorize(owner, project);
      const parsed = restoreInput.parse(input);
      return db
        .transaction(() => {
          authorize(owner, project);
          const current = checkBase(project, parsed.baseVersionId);
          const target = db
            .prepare(
              "SELECT * FROM source_versions WHERE project_id = ? AND id = ?",
            )
            .get(project, parsed.versionId) as Row | undefined;
          if (!target)
            throw new SourceVersionError("NOT_FOUND", "Version unavailable.");
          return save(
            project,
            current,
            version(target).files,
            parsed.summary,
            target.id,
          );
        })
        .immediate();
    },
  };
}
