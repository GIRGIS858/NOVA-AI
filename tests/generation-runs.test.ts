import { beforeEach, afterEach, describe, it, expect } from "vitest";
import Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import { projectStore } from "../src/lib/projects";
import { migrateSourceVersions, sourceVersionStore } from "../src/lib/versions";
import {
  generationRunStore,
  migrateGenerationRuns,
} from "../src/lib/generation-runs";
describe("durable generation runs", () => {
  let db: Database.Database;
  let project: string;
  let runs: ReturnType<typeof generationRunStore>;
  let sources: ReturnType<typeof sourceVersionStore>;
  const input = () => ({
    requestId: randomUUID(),
    prompt: "Build a polished studio website",
  });
  const output = {
    summary: "New page",
    changes: [
      { type: "write", path: "index.html", content: "<h1>Studio</h1>" },
    ],
  };
  const usage = { inputTokens: 200, outputTokens: 400 };
  beforeEach(() => {
    db = new Database(":memory:");
    db.pragma("foreign_keys=ON");
    project = projectStore(db).create("alice", {
      name: "Studio",
      brief: "A modern architectural studio",
    });
    migrateSourceVersions(db);
    migrateGenerationRuns(db);
    runs = generationRunStore(db);
    sources = sourceVersionStore(db);
  });
  afterEach(() => db.close());
  it("deduplicates identical requests and rejects key reuse", () => {
    const value = input();
    const a = runs.start("alice", project, value, "free:model");
    const b = runs.start("alice", project, value, "free:model");
    expect(b.created).toBe(false);
    expect(b.run.id).toBe(a.run.id);
    expect(() =>
      runs.start(
        "alice",
        project,
        { ...value, prompt: "Different instructions" },
        "free:model",
      ),
    ).toThrow("IDEMPOTENCY_CONFLICT");
    expect(() => runs.start("alice", project, input(), "free:model")).toThrow(
      "BUSY",
    );
  });
  it("atomically commits source and completion", () => {
    const { run } = runs.start("alice", project, input(), "free:model");
    const result = runs.complete("alice", project, run.id, output, usage);
    expect(result.status).toBe("completed");
    expect(result.version_id).toBe(sources.latest("alice", project)?.id);
    expect(result.output_tokens).toBe(400);
  });
  it("lets cancellation win against a late response", () => {
    const { run } = runs.start("alice", project, input(), "free:model");
    runs.cancel("alice", project, run.id);
    expect(() =>
      runs.complete("alice", project, run.id, output, usage),
    ).toThrow("INACTIVE");
    expect(
      runs.fail("alice", project, run.id, "PROVIDER_UNAVAILABLE").status,
    ).toBe("cancelled");
    expect(sources.latest("alice", project)).toBeNull();
  });
  it("does not overwrite source committed during inference", () => {
    const { run } = runs.start("alice", project, input(), "free:model");
    sources.commit("alice", project, { baseVersionId: null, ...output });
    expect(() =>
      runs.complete("alice", project, run.id, output, usage),
    ).toThrow("Reload its latest version");
    expect(sources.list("alice", project)).toHaveLength(1);
    expect(runs.get("alice", project, run.id).status).toBe("running");
  });
  it("rolls back invalid source and isolates run ownership", () => {
    const { run } = runs.start("alice", project, input(), "free:model");
    expect(() =>
      runs.complete(
        "alice",
        project,
        run.id,
        {
          summary: "Bad",
          changes: [{ type: "write", path: "../evil.ts", content: "bad" }],
        },
        usage,
      ),
    ).toThrow();
    expect(sources.latest("alice", project)).toBeNull();
    for (const call of [
      () => runs.list("bob", project),
      () => runs.get("bob", project, run.id),
      () => runs.cancel("bob", project, run.id),
      () => runs.start("bob", project, input(), "free:model"),
    ])
      expect(call).toThrow("NOT_FOUND");
  });
  it("reconciles interrupted work and enforces rolling attempt limits", () => {
    const { run } = runs.start("alice", project, input(), "free:model");
    db.prepare("UPDATE generation_runs SET created_at=? WHERE id=?").run(
      new Date(Date.now() - 130000).toISOString(),
      run.id,
    );
    expect(runs.list("alice", project)[0].error_code).toBe("INTERRUPTED");
    for (let i = 1; i < 20; i++) {
      const next = runs.start("alice", project, input(), "free:model").run;
      runs.fail("alice", project, next.id, "RATE_LIMITED");
    }
    expect(() => runs.start("alice", project, input(), "free:model")).toThrow(
      "DAILY_LIMIT",
    );
  });
});
