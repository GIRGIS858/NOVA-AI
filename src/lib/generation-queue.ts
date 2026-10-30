import type Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import {
  generationStore,
  expireGenerationRuns,
  GENERATION_LIMITS,
  GenerationStoreError,
} from "./generation-store";
import { projectStore } from "./projects";
import {
  generationContext,
  latestNotesWithinBudget,
  MAX_PROMPT_CHARS,
  type SourceContext,
} from "./generation-context";

export const QUEUE_WAIT_MS = 10 * 60_000;
export type JobPhase =
  "queued" | "generating" | "validating" | "succeeded" | "failed" | "cancelled";
export type ClaimedJob = {
  runId: string;
  owner: string;
  projectId: string;
  token: string;
  provider: string;
  model: string;
  prompt: string;
  source: SourceContext;
};

type Job = {
  run_id: string;
  payload_json: string | null;
  provider: string;
  model: string;
  phase: JobPhase;
  token: string | null;
  expires_at: number;
};
/** Private payloads are never included in public status, and are erased on settlement. */
export function generationQueue(db: Database.Database) {
  const generations = generationStore(db);
  const projects = projectStore(db);
  const job = (id: string) =>
    db.prepare("SELECT * FROM generation_jobs WHERE run_id = ?").get(id) as
      Job | undefined;
  const event = (runId: string, phase: JobPhase, now: number) =>
    db
      .prepare(
        "INSERT INTO generation_events(run_id, phase, created_at) VALUES (?, ?, ?)",
      )
      .run(runId, phase, now);
  const ownsLease = (claim: ClaimedJob, now: number) => {
    const row = job(claim.runId);
    return Boolean(
      row &&
      row.token === claim.token &&
      row.expires_at > now &&
      (row.phase === "generating" || row.phase === "validating"),
    );
  };
  return {
    reconcile(now = Date.now()) {
      expireGenerationRuns(db, now);
    },
    enqueue(
      owner: string,
      projectId: string,
      requestId: string,
      config: { provider: string; model: string },
      now = Date.now(),
    ) {
      return db
        .transaction(() => {
          const reservation = generations.reserve(
            owner,
            projectId,
            requestId,
            now,
          );
          if (reservation.existing) return reservation;
          const project = projects.get(owner, projectId)!;
          const notes = projects
            .recentMessages(owner, projectId)
            .map((note) => note.content)
            .join("\n\n");
          const prefix = `Project: ${project.name}\nBrief:\n${project.brief}\n\nLatest saved notes (older content may be omitted):\n`;
          const prompt =
            prefix +
            latestNotesWithinBudget(notes, MAX_PROMPT_CHARS - prefix.length);
          generationContext(prompt, reservation.source);
          // Enqueue and source capture are one transaction. Neither keys nor runtime hosts are stored.
          db.prepare(
            `INSERT INTO generation_jobs(run_id,payload_json,provider,model,phase,token,expires_at,created_at)
          VALUES(?,?,?,?, 'queued',NULL,?,?)`,
          ).run(
            reservation.run.id,
            JSON.stringify({ prompt, source: reservation.source }),
            config.provider,
            config.model,
            now + QUEUE_WAIT_MS,
            now,
          );
          db.prepare(
            "UPDATE generation_attempts SET lease_expires_at = ? WHERE run_id = ?",
          ).run(now + QUEUE_WAIT_MS, reservation.run.id);
          event(reservation.run.id, "queued", now);
          return { run: reservation.run, existing: false };
        })
        .immediate();
    },
    claim(now = Date.now()): ClaimedJob | undefined {
      return db
        .transaction(() => {
          expireGenerationRuns(db, now);
          const row = db
            .prepare(
              `SELECT j.*, r.owner_id, r.project_id FROM generation_jobs j
          JOIN generation_runs r ON r.id = j.run_id JOIN projects p ON p.id = r.project_id AND p.owner_id = r.owner_id
          WHERE j.phase = 'queued' AND r.status = 'running' ORDER BY j.created_at, j.rowid LIMIT 1`,
            )
            .get() as
            (Job & { owner_id: string; project_id: string }) | undefined;
          if (!row || !row.payload_json) return;
          const token = randomUUID();
          db.prepare(
            "UPDATE generation_jobs SET phase = 'generating', token = ?, expires_at = ? WHERE run_id = ?",
          ).run(token, now + GENERATION_LIMITS.leaseMs, row.run_id);
          // The retained ledger keeps the claimed lease even if project deletion cascades the job.
          db.prepare(
            "UPDATE generation_attempts SET lease_expires_at = ? WHERE run_id = ?",
          ).run(now + GENERATION_LIMITS.leaseMs, row.run_id);
          event(row.run_id, "generating", now);
          const payload = JSON.parse(row.payload_json) as {
            prompt: string;
            source: SourceContext;
          };
          return {
            runId: row.run_id,
            owner: row.owner_id,
            projectId: row.project_id,
            token,
            provider: row.provider,
            model: row.model,
            ...payload,
          };
        })
        .immediate();
    },
    active(claim: ClaimedJob, now = Date.now()) {
      expireGenerationRuns(db, now);
      return (
        ownsLease(claim, now) &&
        generations.getRun(claim.owner, claim.runId, now)?.status === "running"
      );
    },
    validating(claim: ClaimedJob, now = Date.now()) {
      return db
        .transaction(() => {
          expireGenerationRuns(db, now);
          if (!ownsLease(claim, now)) return false;
          db.prepare(
            "UPDATE generation_jobs SET phase = 'validating' WHERE run_id = ?",
          ).run(claim.runId);
          event(claim.runId, "validating", now);
          return true;
        })
        .immediate();
    },
    complete(
      claim: ClaimedJob,
      files: Array<{ path: string; content: string }>,
      now = Date.now(),
    ) {
      return db
        .transaction(() => {
          expireGenerationRuns(db, now);
          if (!ownsLease(claim, now)) return null;
          const version = generations.complete(
            claim.owner,
            claim.runId,
            files,
            now,
          );
          expireGenerationRuns(db, now);
          return version;
        })
        .immediate();
    },
    settle(claim: ClaimedJob, code: string, now = Date.now()) {
      return db
        .transaction(() => {
          const row = job(claim.runId);
          if (row && row.token !== claim.token) return;
          // A stale process cannot fail an active lease. Deleted/cancelled jobs still release their ledger.
          if (row && ownsLease(claim, now))
            generations.fail(claim.owner, claim.runId, code, now);
          expireGenerationRuns(db, now);
          generations.release(claim.owner, claim.runId, now);
        })
        .immediate();
    },
    cancel(owner: string, projectId: string, runId: string, now = Date.now()) {
      return db
        .transaction(() => {
          const run = generations.getRun(owner, runId, now);
          if (!run || run.project_id !== projectId)
            throw new GenerationStoreError("unavailable");
          generations.cancel(owner, projectId, runId, now);
          const row = job(runId);
          if (row && !row.token) generations.release(owner, runId, now);
          expireGenerationRuns(db, now);
        })
        .immediate();
    },
    runs(owner: string, projectId: string, now = Date.now()) {
      return generations.runs(owner, projectId, now).map((run) => ({
        ...run,
        phase:
          job(run.id)?.phase ||
          (run.status === "running" ? "generating" : run.status),
        events: db
          .prepare(
            "SELECT phase, created_at FROM generation_events WHERE run_id = ? ORDER BY id LIMIT 8",
          )
          .all(run.id) as Array<{ phase: JobPhase; created_at: number }>,
      }));
    },
  };
}
