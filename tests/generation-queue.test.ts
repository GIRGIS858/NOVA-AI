import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { generationQueue, QUEUE_WAIT_MS } from "../src/lib/generation-queue";
import {
  migrateGeneration,
  generationStore,
  GENERATION_LIMITS,
} from "../src/lib/generation-store";
import { migrateSourceVersions, sourceVersionStore } from "../src/lib/versions";
import { projectStore } from "../src/lib/projects";
import { processNextGeneration } from "../src/lib/generation-worker";
import { ProviderError } from "../src/lib/ai-provider";
const config = { provider: "ollama", model: "fixture:7b" };
const files = [
  { path: "index.html", content: "<h1>Worker fixture</h1>" },
  { path: "styles.css", content: "h1{color:teal}" },
];
describe("durable generation queue", () => {
  let db: Database.Database, folder: string, path: string, project: string;
  let queue: ReturnType<typeof generationQueue>;
  let projects: ReturnType<typeof projectStore>;
  const enqueue = (now = Date.now(), requestId = randomUUID()) =>
    queue.enqueue("alice", project, requestId, config, now);
  const reopen = () => {
    db = new Database(path);
    db.pragma("foreign_keys = ON");
    db.pragma("journal_mode = WAL");
    projects = projectStore(db);
    queue = generationQueue(db);
  };
  beforeEach(() => {
    folder = mkdtempSync(join(tmpdir(), "nova-queue-"));
    path = join(folder, "test.sqlite");
    reopen();
    migrateSourceVersions(db);
    migrateGeneration(db);
    project = projects.create("alice", {
      name: "Private project",
      brief: "Private brief captured before work starts.",
    });
  });
  afterEach(() => {
    db.close();
    rmSync(folder, { recursive: true, force: true });
  });
  it("survives a database restart and queues beyond the old request lease", () => {
    const now = Date.now(),
      id = randomUUID();
    const first = enqueue(now, id);
    db.close();
    reopen();
    migrateGeneration(db);
    expect(enqueue(now + 130_000, id)).toMatchObject({
      existing: true,
      run: { id: first.run.id, status: "running" },
    });
    const claim = queue.claim(now + 130_000)!;
    expect(claim.runId).toBe(first.run.id);
    expect(queue.complete(claim, files, now + 130_001)).not.toBeNull();
    expect(queue.runs("alice", project, now + 130_002)[0]).toMatchObject({
      phase: "succeeded",
    });
  });
  it("allows one claim across independent SQLite connections and fences wrong tokens", () => {
    enqueue();
    const second = new Database(path);
    second.pragma("foreign_keys = ON");
    try {
      const claim = queue.claim()!;
      expect(generationQueue(second).claim()).toBeUndefined();
      expect(queue.complete({ ...claim, token: "wrong" }, files)).toBeNull();
      expect(queue.complete(claim, files)).not.toBeNull();
      expect(queue.complete(claim, files)).toBeNull();
      expect(sourceVersionStore(db).list("alice", project)).toHaveLength(1);
    } finally {
      second.close();
    }
  });
  it("captures source and requirements at enqueue and hides/cleans private payloads", () => {
    const sources = sourceVersionStore(db);
    const first = sources.commit("alice", project, {
      baseVersionId: null,
      summary: "Initial",
      changes: files.map((file) => ({ type: "write" as const, ...file })),
    });
    projects.addMessage("alice", project, "Private queued instruction");
    enqueue();
    projects.addMessage("alice", project, "Later instruction");
    sources.commit("alice", project, {
      baseVersionId: first.id,
      summary: "Concurrent",
      changes: [
        { type: "write", path: "index.html", content: "<h1>Newer</h1>" },
      ],
    });
    const claim = queue.claim()!;
    expect(claim.source.files).toEqual(files);
    expect(claim.prompt).toContain("Private queued instruction");
    expect(claim.prompt).not.toContain("Later instruction");
    expect(JSON.stringify(queue.runs("alice", project))).not.toMatch(
      /Private queued instruction|Private brief|payload_json|token/,
    );
    expect(queue.runs("bob", project)).toEqual([]);
    expect(() => queue.complete(claim, files)).toThrow("conflict");
    queue.settle(claim, "conflict");
    expect(
      db.prepare("SELECT payload_json FROM generation_jobs").get(),
    ).toEqual({ payload_json: null });
  });
  it("expires abandoned queued jobs and never retries the same request", () => {
    const now = Date.now(),
      id = randomUUID();
    enqueue(now, id);
    expect(queue.claim(now + QUEUE_WAIT_MS)).toBeUndefined();
    expect(enqueue(now + QUEUE_WAIT_MS + 1, id)).toMatchObject({
      existing: true,
      run: { status: "failed", error_code: "interrupted" },
    });
    expect(
      db.prepare("SELECT COUNT(*) AS n FROM generation_attempts").get(),
    ).toEqual({ n: 1 });
  });
  it("expires a crashed claimed worker and rejects late output", () => {
    const now = Date.now();
    enqueue(now);
    const claim = queue.claim(now)!;
    queue.reconcile(now + GENERATION_LIMITS.leaseMs);
    expect(
      queue.complete(claim, files, now + GENERATION_LIMITS.leaseMs + 1),
    ).toBeNull();
    expect(queue.claim(now + GENERATION_LIMITS.leaseMs + 1)).toBeUndefined();
    expect(
      queue
        .runs("alice", project, now + GENERATION_LIMITS.leaseMs + 1)[0]
        .events.map((e) => e.phase),
    ).toEqual(["queued", "generating", "failed"]);
  });
  it("cancels queued work immediately while protecting other owners", () => {
    const run = enqueue().run;
    expect(() => queue.cancel("bob", project, run.id)).toThrow("unavailable");
    queue.cancel("alice", project, run.id);
    expect(queue.claim()).toBeUndefined();
    expect(enqueue().run.status).toBe("running");
    expect(
      queue
        .runs("alice", project)
        .find((r) => r.id === run.id)
        ?.events.map((e) => e.phase),
    ).toEqual(["queued", "cancelled"]);
  });
  it("holds a claimed cancellation until acknowledgement", () => {
    const run = enqueue().run,
      claim = queue.claim()!;
    queue.cancel("alice", project, run.id);
    expect(() => enqueue()).toThrow("owner_busy");
    expect(queue.complete(claim, files)).toBeNull();
    queue.settle(claim, "cancelled");
    expect(enqueue().run.status).toBe("running");
  });
  it("removes private jobs on project deletion but retains attempt accounting", () => {
    enqueue();
    const claim = queue.claim()!;
    projects.remove("alice", project);
    expect(queue.complete(claim, files)).toBeNull();
    queue.settle(claim, "cancelled");
    expect(
      db.prepare("SELECT COUNT(*) AS n FROM generation_jobs").get(),
    ).toEqual({ n: 0 });
    expect(
      db.prepare("SELECT COUNT(*) AS n FROM generation_events").get(),
    ).toEqual({ n: 0 });
    expect(
      db
        .prepare(
          "SELECT COUNT(*) AS n FROM generation_attempts WHERE finished_at IS NOT NULL",
        )
        .get(),
    ).toEqual({ n: 1 });
  });
  it("releases an unclaimed job atomically when its project is deleted", () => {
    enqueue();
    projects.remove("alice", project);
    const next = projects.create("alice", {
      name: "New project",
      brief: "Next project should not wait for a deleted queued job.",
    });
    expect(queue.enqueue("alice", next, randomUUID(), config).run.status).toBe(
      "running",
    );
    expect(
      db
        .prepare(
          "SELECT COUNT(*) AS n FROM generation_attempts WHERE finished_at IS NOT NULL",
        )
        .get(),
    ).toEqual({ n: 1 });
  });
  it.each(["acknowledgement", "expiry"])(
    "retains a delayed worker lease after deletion until %s",
    (release) => {
      const now = Date.now();
      enqueue(now);
      const claim = queue.claim(now + 130_000)!;
      projects.remove("alice", project);
      const other = projects.create("alice", {
        name: "Another project",
        brief: "A second project for lease verification.",
      });
      const reserve = (at: number) =>
        queue.enqueue("alice", other, randomUUID(), config, at);
      expect(() => reserve(now + 130_001)).toThrow("owner_busy");
      if (release === "acknowledgement") {
        queue.settle(claim, "cancelled", now + 130_002);
        expect(reserve(now + 130_003).run.status).toBe("running");
      } else {
        expect(() => reserve(now + 249_999)).toThrow("owner_busy");
        expect(reserve(now + 250_000).run.status).toBe("running");
      }
    },
  );
  it("rolls back reservation if source validation prevents enqueue", () => {
    sourceVersionStore(db).commit("alice", project, {
      baseVersionId: null,
      summary: "Oversized static",
      changes: [
        {
          type: "write",
          path: "index.html",
          content: "x".repeat(102401),
        },
        { type: "write", path: "styles.css", content: "" },
      ],
    });
    expect(() => enqueue()).toThrow("unsupported_source");
    expect(
      db.prepare("SELECT COUNT(*) AS n FROM generation_attempts").get(),
    ).toEqual({ n: 0 });
  });
  it("runs the worker once, persists phases and removes private payload", async () => {
    enqueue();
    const generate = vi.fn().mockResolvedValue(files);
    const options = {
      ...config,
      apiKey: "",
      signal: new AbortController().signal,
      generate,
    };
    expect(await processNextGeneration(queue, options)).toBe(true);
    expect(await processNextGeneration(queue, options)).toBe(false);
    expect(generate).toHaveBeenCalledTimes(1);
    const run = queue.runs("alice", project)[0];
    expect(run.status).toBe("succeeded");
    expect(run.events.map((e) => e.phase)).toEqual([
      "queued",
      "generating",
      "validating",
      "succeeded",
    ]);
    expect(
      db.prepare("SELECT payload_json FROM generation_jobs").get(),
    ).toEqual({ payload_json: null });
  });
  it("rejects changed worker configuration without sending private data", async () => {
    enqueue();
    const generate = vi.fn();
    await processNextGeneration(queue, {
      provider: "openrouter",
      model: "other:free",
      apiKey: "",
      signal: new AbortController().signal,
      generate,
    });
    expect(generate).not.toHaveBeenCalled();
    expect(queue.runs("alice", project)[0].error_code).toBe(
      "configuration_changed",
    );
  });
  it("does not publish after cancellation even if a provider returns output", async () => {
    const run = enqueue().run;
    await processNextGeneration(queue, {
      ...config,
      apiKey: "",
      signal: new AbortController().signal,
      generate: async () => {
        queue.cancel("alice", project, run.id);
        return files;
      },
    });
    expect(queue.runs("alice", project)[0].status).toBe("cancelled");
    expect(sourceVersionStore(db).list("alice", project)).toEqual([]);
    expect(enqueue().run.status).toBe("running");
  });
  it("reports safe local-runtime failures", async () => {
    enqueue();
    await processNextGeneration(queue, {
      ...config,
      apiKey: "",
      signal: new AbortController().signal,
      generate: async () => {
        throw new ProviderError("local_model_unavailable");
      },
    });
    expect(queue.runs("alice", project)[0].error_code).toBe(
      "local_model_unavailable",
    );
  });
  it("rejects unsafe artifacts before committing source", async () => {
    enqueue();
    await processNextGeneration(queue, {
      ...config,
      apiKey: "",
      signal: new AbortController().signal,
      generate: async () => [
        { path: "index.html", content: "<script>bad()</script>" },
        files[1],
      ],
    });
    expect(queue.runs("alice", project)[0].status).toBe("failed");
    expect(sourceVersionStore(db).list("alice", project)).toEqual([]);
  });
  it("interrupts active work on worker shutdown without retry", async () => {
    enqueue();
    const shutdown = new AbortController();
    await processNextGeneration(queue, {
      ...config,
      apiKey: "",
      signal: shutdown.signal,
      generate: async ({ signal }) => {
        shutdown.abort();
        signal.throwIfAborted();
        return files;
      },
    });
    expect(queue.runs("alice", project)[0].error_code).toBe("interrupted");
    expect(queue.claim()).toBeUndefined();
  });
});
