import type Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import { z } from "zod";

export type GenerationRun = {
  id: string;
  project_id: string;
  owner_id: string;
  request_id: string;
  status: "running" | "succeeded" | "failed" | "cancelled";
  error_code: string | null;
  created_at: number;
  finished_at: number | null;
};
export type SourceVersion = {
  id: string;
  project_id: string;
  run_id: string;
  created_at: number;
  files_json: string;
};
export type SourceVersionSummary = Omit<SourceVersion, "files_json">;
export type GenerationStoreErrorCode =
  | "unavailable"
  | "invalid_request"
  | "request_conflict"
  | "owner_daily_limit"
  | "global_daily_limit"
  | "owner_busy"
  | "global_busy";
export class GenerationStoreError extends Error {
  constructor(public readonly code: GenerationStoreErrorCode) {
    super(code);
    this.name = "GenerationStoreError";
  }
}

export const GENERATION_LIMITS = {
  ownerDaily: 3,
  globalDaily: 20,
  globalConcurrent: 3,
  leaseMs: 120_000,
  windowMs: 24 * 60 * 60 * 1000,
} as const;
const requestSchema = z.uuid();
const filesSchema = z
  .array(
    z
      .object({
        path: z.enum(["index.html", "styles.css"]),
        content: z.string().max(200_000),
      })
      .strict(),
  )
  .length(2)
  .refine((files) => new Set(files.map((f) => f.path)).size === 2);
const failureCodes = new Set([
  "provider_error",
  "provider_timeout",
  "invalid_output",
  "interrupted",
  "provider_unavailable",
  "internal_error",
  "cancelled",
  "timeout",
]);

/** Single-instance SQLite store; the reservation transaction serializes all writers. */
export function generationStore(db: Database.Database) {
  db.transaction(() => {
    db.exec(`CREATE TABLE IF NOT EXISTS nova_schema_migrations (
      version TEXT PRIMARY KEY, applied_at INTEGER NOT NULL
    )`);
    if (
      db
        .prepare("SELECT 1 FROM nova_schema_migrations WHERE version = ?")
        .get("generation-v1")
    )
      return;
    db.exec(`
      CREATE TABLE generation_runs (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        owner_id TEXT NOT NULL,
        request_id TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('running', 'succeeded', 'failed', 'cancelled')),
        error_code TEXT,
        created_at INTEGER NOT NULL,
        finished_at INTEGER,
        UNIQUE (owner_id, request_id)
      );
      CREATE UNIQUE INDEX generation_owner_active ON generation_runs(owner_id) WHERE status = 'running';
      CREATE INDEX generation_project_runs ON generation_runs(project_id, created_at DESC);
      CREATE TABLE source_versions (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        run_id TEXT NOT NULL UNIQUE REFERENCES generation_runs(id) ON DELETE CASCADE,
        created_at INTEGER NOT NULL,
        files_json TEXT NOT NULL
      );
      CREATE INDEX versions_project ON source_versions(project_id, created_at DESC);
      CREATE TABLE generation_attempts (
        owner_id TEXT NOT NULL, request_id TEXT NOT NULL,
        project_id TEXT NOT NULL, run_id TEXT NOT NULL,
        created_at INTEGER NOT NULL, finished_at INTEGER,
        PRIMARY KEY (owner_id, request_id)
      );
      CREATE INDEX attempts_time ON generation_attempts(created_at);
      CREATE INDEX attempts_owner_time ON generation_attempts(owner_id, created_at);
    `);
    db.prepare("INSERT INTO nova_schema_migrations VALUES (?, ?)").run(
      "generation-v1",
      Date.now(),
    );
  }).immediate();

  const ownedProject = (owner: string, projectId: string) =>
    Boolean(
      db
        .prepare("SELECT 1 FROM projects WHERE id = ? AND owner_id = ?")
        .get(projectId, owner),
    );
  const expire = (now: number) => {
    db.prepare(
      "UPDATE generation_runs SET status = 'failed', error_code = 'interrupted', finished_at = ? WHERE status = 'running' AND created_at <= ?",
    ).run(now, now - GENERATION_LIMITS.leaseMs);
    db.prepare(
      "UPDATE generation_attempts SET finished_at = ? WHERE finished_at IS NULL AND created_at <= ?",
    ).run(now, now - GENERATION_LIMITS.leaseMs);
  };
  const findRun = (owner: string, runId: string) =>
    db
      .prepare(
        `SELECT r.* FROM generation_runs r JOIN projects p ON p.id = r.project_id
     WHERE r.id = ? AND r.owner_id = ? AND p.owner_id = ?`,
      )
      .get(runId, owner, owner) as GenerationRun | undefined;
  const count = (sql: string, ...args: (string | number)[]) =>
    (db.prepare(sql).get(...args) as { count: number }).count;

  return {
    reserve(
      owner: string,
      projectId: string,
      requestId: string,
      now = Date.now(),
    ) {
      if (
        !owner ||
        !requestSchema.safeParse(requestId).success ||
        !Number.isSafeInteger(now)
      ) {
        throw new GenerationStoreError("invalid_request");
      }
      return db
        .transaction(() => {
          if (!ownedProject(owner, projectId))
            throw new GenerationStoreError("unavailable");
          expire(now);
          const prior = db
            .prepare(
              "SELECT * FROM generation_attempts WHERE owner_id = ? AND request_id = ?",
            )
            .get(owner, requestId) as
            { project_id: string; run_id: string } | undefined;
          if (prior) {
            if (prior.project_id !== projectId)
              throw new GenerationStoreError("request_conflict");
            const run = findRun(owner, prior.run_id);
            if (!run) throw new GenerationStoreError("request_conflict");
            return { run, existing: true };
          }
          const since = now - GENERATION_LIMITS.windowMs;
          if (
            count(
              "SELECT COUNT(*) AS count FROM generation_attempts WHERE owner_id = ? AND created_at > ?",
              owner,
              since,
            ) >= GENERATION_LIMITS.ownerDaily
          ) {
            throw new GenerationStoreError("owner_daily_limit");
          }
          if (
            count(
              "SELECT COUNT(*) AS count FROM generation_attempts WHERE created_at > ?",
              since,
            ) >= GENERATION_LIMITS.globalDaily
          ) {
            throw new GenerationStoreError("global_daily_limit");
          }
          if (
            count(
              "SELECT COUNT(*) AS count FROM generation_attempts WHERE owner_id = ? AND finished_at IS NULL",
              owner,
            )
          ) {
            throw new GenerationStoreError("owner_busy");
          }
          if (
            count(
              "SELECT COUNT(*) AS count FROM generation_attempts WHERE finished_at IS NULL",
            ) >= GENERATION_LIMITS.globalConcurrent
          ) {
            throw new GenerationStoreError("global_busy");
          }
          const run: GenerationRun = {
            id: randomUUID(),
            project_id: projectId,
            owner_id: owner,
            request_id: requestId,
            status: "running",
            error_code: null,
            created_at: now,
            finished_at: null,
          };
          db.prepare(
            `INSERT INTO generation_runs
          (id, project_id, owner_id, request_id, status, error_code, created_at, finished_at)
          VALUES (@id, @project_id, @owner_id, @request_id, @status, @error_code, @created_at, @finished_at)`,
          ).run(run);
          db.prepare(
            "INSERT INTO generation_attempts VALUES (?, ?, ?, ?, ?, NULL)",
          ).run(owner, requestId, projectId, run.id, now);
          return { run, existing: false };
        })
        .immediate();
    },
    complete(
      owner: string,
      runId: string,
      files: Array<{ path: string; content: string }>,
      now = Date.now(),
    ): SourceVersion | null {
      const parsed = filesSchema.safeParse(files);
      if (!parsed.success) throw new GenerationStoreError("invalid_request");
      const serialized = JSON.stringify(parsed.data);
      if (Buffer.byteLength(serialized, "utf8") > 300_000)
        throw new GenerationStoreError("invalid_request");
      return db
        .transaction(() => {
          expire(now);
          const run = findRun(owner, runId);
          if (!run || run.status !== "running") return null;
          const version: SourceVersion = {
            id: randomUUID(),
            project_id: run.project_id,
            run_id: run.id,
            created_at: now,
            files_json: serialized,
          };
          db.prepare(
            "INSERT INTO source_versions (id, project_id, run_id, created_at, files_json) VALUES (@id, @project_id, @run_id, @created_at, @files_json)",
          ).run(version);
          db.prepare(
            "UPDATE generation_runs SET status = 'succeeded', finished_at = ?, error_code = NULL WHERE id = ? AND status = 'running'",
          ).run(now, runId);
          db.prepare(
            "UPDATE generation_attempts SET finished_at = ? WHERE owner_id = ? AND run_id = ?",
          ).run(now, owner, runId);
          db.prepare(
            "UPDATE projects SET updated_at = ? WHERE id = ? AND owner_id = ?",
          ).run(new Date(now).toISOString(), run.project_id, owner);
          return version;
        })
        .immediate();
    },
    fail(owner: string, runId: string, code: string, now = Date.now()) {
      // Never persist upstream error text, which may contain credentials or prompts.
      const safeCode = failureCodes.has(code) ? code : "internal_error";
      return db
        .transaction(() => {
          const changed =
            db
              .prepare(
                `UPDATE generation_runs SET status = 'failed', error_code = ?, finished_at = ?
          WHERE id = ? AND owner_id = ? AND status = 'running'
          AND project_id IN (SELECT id FROM projects WHERE owner_id = ?)`,
              )
              .run(safeCode, now, runId, owner, owner).changes > 0;
          if (changed)
            db.prepare(
              "UPDATE generation_attempts SET finished_at = ? WHERE owner_id = ? AND run_id = ?",
            ).run(now, owner, runId);
          return changed;
        })
        .immediate();
    },
    cancel(owner: string, projectId: string, runId: string, now = Date.now()) {
      // Keep the concurrency lease until the worker acknowledges the upstream abort.
      // A cancelled browser request does not prove the provider has stopped running.
      return (
        db
          .prepare(
            `UPDATE generation_runs SET status = 'cancelled', error_code = 'cancelled', finished_at = ?
        WHERE id = ? AND project_id = ? AND owner_id = ? AND status = 'running'
        AND project_id IN (SELECT id FROM projects WHERE owner_id = ?)`,
          )
          .run(now, runId, projectId, owner, owner).changes > 0
      );
    },
    release(owner: string, runId: string, now = Date.now()) {
      // Called only by the worker after settlement, never by a client cancellation.
      // The ledger survives project deletion, so even a deleted run can be released.
      return (
        db
          .prepare(
            `UPDATE generation_attempts SET finished_at = ?
        WHERE owner_id = ? AND run_id = ? AND finished_at IS NULL
        AND NOT EXISTS (SELECT 1 FROM generation_runs WHERE id = ? AND status = 'running')`,
          )
          .run(now, owner, runId, runId).changes > 0
      );
    },
    runs(owner: string, projectId: string, now = Date.now()) {
      if (!ownedProject(owner, projectId)) return [] as GenerationRun[];
      expire(now);
      return db
        .prepare(
          "SELECT * FROM generation_runs WHERE project_id = ? AND owner_id = ? ORDER BY created_at DESC, rowid DESC LIMIT 20",
        )
        .all(projectId, owner) as GenerationRun[];
    },
    versions(owner: string, projectId: string) {
      if (!ownedProject(owner, projectId)) return [] as SourceVersionSummary[];
      return db
        .prepare(
          "SELECT id, project_id, run_id, created_at FROM source_versions WHERE project_id = ? ORDER BY created_at DESC, rowid DESC LIMIT 20",
        )
        .all(projectId) as SourceVersionSummary[];
    },
    version(owner: string, projectId: string, versionId: string) {
      if (!ownedProject(owner, projectId)) return undefined;
      return db
        .prepare(
          "SELECT * FROM source_versions WHERE id = ? AND project_id = ?",
        )
        .get(versionId, projectId) as SourceVersion | undefined;
    },
    getRun(owner: string, runId: string, now = Date.now()) {
      expire(now);
      return findRun(owner, runId);
    },
  };
}
