import type Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { sourceVersionStore } from "./versions";

export const runInput = z
  .object({
    requestId: z.string().uuid(),
    prompt: z.string().trim().min(10).max(8000),
  })
  .strict();
export const RUN_TIMEOUT_MS = 120_000;
type State = "running" | "validating" | "completed" | "failed" | "cancelled";
export type GenerationRun = {
  id: string;
  project_id: string;
  owner_id: string;
  request_id: string;
  prompt: string;
  model: string;
  status: State;
  base_version_id: string | null;
  version_id: string | null;
  error_code: string | null;
  created_at: string;
  finished_at: string | null;
  input_tokens: number | null;
  output_tokens: number | null;
};
export class GenerationRunError extends Error {
  constructor(public readonly code: string) {
    super(code);
  }
}
export function migrateGenerationRuns(db: Database.Database) {
  db.exec(`CREATE TABLE IF NOT EXISTS generation_runs (
  id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE, owner_id TEXT NOT NULL,
  request_id TEXT NOT NULL, prompt TEXT NOT NULL, model TEXT NOT NULL, status TEXT NOT NULL,
  base_version_id TEXT, version_id TEXT, error_code TEXT, created_at TEXT NOT NULL, finished_at TEXT,
  input_tokens INTEGER, output_tokens INTEGER, UNIQUE(owner_id, request_id)
); CREATE UNIQUE INDEX IF NOT EXISTS generation_active_owner ON generation_runs(owner_id) WHERE status IN ('running','validating');
CREATE INDEX IF NOT EXISTS generation_project ON generation_runs(project_id,created_at);`);
}
export function generationRunStore(db: Database.Database) {
  const sources = sourceVersionStore(db);
  const authorize = (owner: string, project: string) => {
    if (
      !db
        .prepare("SELECT id FROM projects WHERE id=? AND owner_id=?")
        .get(project, owner)
    )
      throw new GenerationRunError("NOT_FOUND");
  };
  const reconcile = (owner: string) =>
    db
      .prepare(
        "UPDATE generation_runs SET status='failed',error_code='INTERRUPTED',finished_at=? WHERE owner_id=? AND status IN ('running','validating') AND created_at < ?",
      )
      .run(
        new Date().toISOString(),
        owner,
        new Date(Date.now() - RUN_TIMEOUT_MS).toISOString(),
      );
  const get = (owner: string, project: string, id: string) => {
    authorize(owner, project);
    reconcile(owner);
    const run = db
      .prepare(
        "SELECT * FROM generation_runs WHERE id=? AND project_id=? AND owner_id=?",
      )
      .get(id, project, owner) as GenerationRun | undefined;
    if (!run) throw new GenerationRunError("NOT_FOUND");
    return run;
  };
  return {
    get,
    list(owner: string, project: string) {
      authorize(owner, project);
      reconcile(owner);
      return db
        .prepare(
          "SELECT * FROM generation_runs WHERE owner_id=? AND project_id=? ORDER BY created_at DESC LIMIT 10",
        )
        .all(owner, project) as GenerationRun[];
    },
    start(owner: string, project: string, raw: unknown, model: string) {
      authorize(owner, project);
      const input = runInput.parse(raw);
      return db
        .transaction(() => {
          reconcile(owner);
          authorize(owner, project);
          const prior = db
            .prepare(
              "SELECT * FROM generation_runs WHERE owner_id=? AND request_id=?",
            )
            .get(owner, input.requestId) as GenerationRun | undefined;
          if (prior) {
            if (prior.project_id !== project || prior.prompt !== input.prompt)
              throw new GenerationRunError("IDEMPOTENCY_CONFLICT");
            return { run: prior, created: false };
          }
          if (
            db
              .prepare(
                "SELECT id FROM generation_runs WHERE owner_id=? AND status IN ('running','validating')",
              )
              .get(owner)
          )
            throw new GenerationRunError("BUSY");
          const count = db
            .prepare(
              "SELECT COUNT(*) AS count FROM generation_runs WHERE owner_id=? AND created_at>=?",
            )
            .get(owner, new Date(Date.now() - 86400000).toISOString()) as {
            count: number;
          };
          if (count.count >= 20) throw new GenerationRunError("DAILY_LIMIT");
          const id = randomUUID();
          const now = new Date().toISOString();
          const base = sources.latest(owner, project)?.id || null;
          db.prepare(
            "INSERT INTO generation_runs (id,project_id,owner_id,request_id,prompt,model,status,base_version_id,created_at) VALUES (?,?,?,?,?,?,'running',?,?)",
          ).run(
            id,
            project,
            owner,
            input.requestId,
            input.prompt,
            model,
            base,
            now,
          );
          return { run: get(owner, project, id), created: true };
        })
        .immediate();
    },
    complete(
      owner: string,
      project: string,
      id: string,
      output: unknown,
      usage: { inputTokens: number | null; outputTokens: number | null },
    ) {
      return db
        .transaction(() => {
          const run = get(owner, project, id);
          if (run.status !== "running")
            throw new GenerationRunError("INACTIVE");
          db.prepare(
            "UPDATE generation_runs SET status='validating' WHERE id=?",
          ).run(id);
          const data = z
            .object({ summary: z.string(), changes: z.array(z.unknown()) })
            .parse(output);
          const version = sources.commit(owner, project, {
            baseVersionId: run.base_version_id,
            ...data,
          });
          db.prepare(
            "UPDATE generation_runs SET status='completed',version_id=?,input_tokens=?,output_tokens=?,finished_at=? WHERE id=?",
          ).run(
            version.id,
            usage.inputTokens,
            usage.outputTokens,
            new Date().toISOString(),
            id,
          );
          return get(owner, project, id);
        })
        .immediate();
    },
    fail(owner: string, project: string, id: string, code: string) {
      get(owner, project, id);
      db.prepare(
        "UPDATE generation_runs SET status='failed',error_code=?,finished_at=? WHERE id=? AND status IN ('running','validating')",
      ).run(code, new Date().toISOString(), id);
      return get(owner, project, id);
    },
    cancel(owner: string, project: string, id: string) {
      get(owner, project, id);
      db.prepare(
        "UPDATE generation_runs SET status='cancelled',finished_at=? WHERE id=? AND status IN ('running','validating')",
      ).run(new Date().toISOString(), id);
      return get(owner, project, id);
    },
  };
}
