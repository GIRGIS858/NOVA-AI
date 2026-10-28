import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import Database from "better-sqlite3";
import { projectStore } from "../src/lib/projects";
import {
  generationStore,
  GENERATION_LIMITS,
  GenerationStoreError,
} from "../src/lib/generation-store";

const now = Date.UTC(2026, 9, 28, 10);
const files = [
  { path: "index.html", content: "<h1>Test site</h1>" },
  { path: "styles.css", content: "h1 { color: teal }" },
];
describe("generation reservation and version ownership", () => {
  let db: Database.Database;
  let projects: ReturnType<typeof projectStore>;
  let store: ReturnType<typeof generationStore>;
  const project = (owner = "alice") =>
    projects.create(owner, {
      name: "Private website",
      brief: "A private portfolio website for a creative studio.",
    });
  const reserve = (owner: string, id: string, at = now) =>
    store.reserve(owner, id, randomUUID(), at).run;
  beforeEach(() => {
    db = new Database(":memory:");
    db.pragma("foreign_keys = ON");
    projects = projectStore(db);
    store = generationStore(db);
  });
  afterEach(() => db.close());

  it("migrates once and preserves data on repeated initialization", () => {
    const id = project();
    const run = reserve("alice", id);
    generationStore(db);
    expect(store.getRun("alice", run.id, now)?.status).toBe("running");
    expect(
      db.prepare("SELECT COUNT(*) AS count FROM nova_schema_migrations").get(),
    ).toEqual({ count: 1 });
  });
  it("scopes reservation, transitions, runs and files to the authenticated owner", () => {
    const id = project();
    expect(() => reserve("bob", id)).toThrow("unavailable");
    expect(() => reserve("alice", "missing")).toThrow("unavailable");
    const run = reserve("alice", id);
    expect(store.getRun("bob", run.id, now)).toBeUndefined();
    expect(store.runs("bob", id, now)).toEqual([]);
    expect(store.cancel("bob", id, run.id, now)).toBe(false);
    expect(store.fail("bob", run.id, "provider_error", now)).toBe(false);
    expect(store.complete("bob", run.id, files, now)).toBeNull();
    const version = store.complete("alice", run.id, files, now)!;
    expect(store.versions("bob", id)).toEqual([]);
    expect(store.version("bob", id, version.id)).toBeUndefined();
    expect(
      JSON.parse(store.version("alice", id, version.id)!.files_json),
    ).toEqual(files);
    expect(store.versions("alice", id)[0]).not.toHaveProperty("files_json");
  });
  it("returns existing idempotent requests even after completion, with one version", () => {
    const id = project();
    const requestId = randomUUID();
    const first = store.reserve("alice", id, requestId, now);
    expect(first.existing).toBe(false);
    expect(store.reserve("alice", id, requestId, now)).toEqual({
      run: first.run,
      existing: true,
    });
    const version = store.complete("alice", first.run.id, files, now + 1)!;
    expect(store.complete("alice", first.run.id, files, now + 2)).toBeNull();
    expect(store.reserve("alice", id, requestId, now + 2).run.status).toBe(
      "succeeded",
    );
    expect(store.versions("alice", id)).toHaveLength(1);
    expect(store.versions("alice", id)[0].id).toBe(version.id);
    expect(() => store.reserve("alice", project(), requestId, now)).toThrow(
      "request_conflict",
    );
    expect(() => store.reserve("alice", id, "invalid", now)).toThrow(
      GenerationStoreError,
    );
  });
  it("reserves one active run per owner across projects", () => {
    const firstId = project();
    const secondId = project();
    const run = reserve("alice", firstId);
    expect(() => reserve("alice", secondId)).toThrow("owner_busy");
    store.cancel("alice", firstId, run.id, now);
    expect(() => reserve("alice", secondId)).toThrow("owner_busy");
    expect(store.release("bob", run.id, now)).toBe(false);
    expect(() => reserve("alice", secondId)).toThrow("owner_busy");
    expect(store.release("alice", run.id, now)).toBe(true);
    expect(store.release("alice", run.id, now)).toBe(false);
    expect(reserve("alice", secondId).status).toBe("running");
  });
  it("limits global concurrency across different accounts", () => {
    for (let i = 0; i < 3; i++) reserve(`owner-${i}`, project(`owner-${i}`));
    expect(() => reserve("fourth", project("fourth"))).toThrow("global_busy");
  });
  it("counts failed, cancelled, and successful requests toward the rolling owner limit", () => {
    const id = project();
    store.fail("alice", reserve("alice", id).id, "provider_error", now);
    const cancelled = reserve("alice", id);
    store.cancel("alice", id, cancelled.id, now);
    store.release("alice", cancelled.id, now);
    store.complete("alice", reserve("alice", id).id, files, now);
    expect(() => reserve("alice", id)).toThrow("owner_daily_limit");
    expect(reserve("alice", id, now + GENERATION_LIMITS.windowMs).status).toBe(
      "running",
    );
  });
  it("caps total attempts globally even across many owners", () => {
    for (let i = 0; i < 20; i++) {
      const owner = `owner-${i}`;
      const id = project(owner);
      store.fail(owner, reserve(owner, id).id, "provider_error", now);
    }
    expect(() => reserve("next", project("next"))).toThrow(
      "global_daily_limit",
    );
  });
  it("retains budget accounting after deleting projects", () => {
    for (let i = 0; i < 3; i++) {
      const id = project();
      const run = reserve("alice", id);
      store.complete("alice", run.id, files, now);
      projects.remove("alice", id);
    }
    expect(() => reserve("alice", project())).toThrow("owner_daily_limit");
    expect(
      db.prepare("SELECT COUNT(*) AS count FROM generation_runs").get(),
    ).toEqual({ count: 0 });
    expect(
      db.prepare("SELECT COUNT(*) AS count FROM source_versions").get(),
    ).toEqual({ count: 0 });
    expect(
      db.prepare("SELECT COUNT(*) AS count FROM generation_attempts").get(),
    ).toEqual({ count: 3 });
  });
  it("retains concurrent reservations for deleted projects until the lease expires", () => {
    const id = project();
    const run = reserve("alice", id);
    projects.remove("alice", id);
    const nextId = project();
    expect(() => reserve("alice", nextId)).toThrow("owner_busy");
    expect(store.complete("alice", run.id, files, now)).toBeNull();
    expect(
      reserve("alice", nextId, now + GENERATION_LIMITS.leaseMs).status,
    ).toBe("running");
  });
  it("releases a deleted worker only after its provider operation settles", () => {
    const id = project();
    const run = reserve("alice", id);
    expect(store.release("alice", run.id, now)).toBe(false);
    projects.remove("alice", id);
    const nextId = project();
    expect(() => reserve("alice", nextId)).toThrow("owner_busy");
    expect(store.release("bob", run.id, now)).toBe(false);
    expect(store.release("alice", run.id, now)).toBe(true);
    expect(reserve("alice", nextId).status).toBe("running");
  });
  it("expires a cancelled lease when its worker never acknowledges", () => {
    const id = project();
    const run = reserve("alice", id);
    store.cancel("alice", id, run.id, now);
    expect(() => reserve("alice", id)).toThrow("owner_busy");
    expect(reserve("alice", id, now + GENERATION_LIMITS.leaseMs).status).toBe(
      "running",
    );
    expect(
      store.getRun("alice", run.id, now + GENERATION_LIMITS.leaseMs)?.status,
    ).toBe("cancelled");
  });
  it("does not publish a cancelled run or change a completed run's status", () => {
    const id = project();
    const cancelled = reserve("alice", id);
    expect(store.cancel("alice", id, cancelled.id, now)).toBe(true);
    expect(store.complete("alice", cancelled.id, files, now + 1)).toBeNull();
    expect(store.fail("alice", cancelled.id, "provider_error", now)).toBe(
      false,
    );
    store.release("alice", cancelled.id, now);
    const success = reserve("alice", id);
    store.complete("alice", success.id, files, now);
    expect(store.cancel("alice", id, success.id, now)).toBe(false);
    expect(store.fail("alice", success.id, "provider_error", now)).toBe(false);
    expect(store.getRun("alice", success.id, now)?.status).toBe("succeeded");
  });
  it("expires interrupted runs on read/reserve and rejects late results", () => {
    const id = project();
    const interrupted = reserve("alice", id);
    expect(
      store.complete(
        "alice",
        interrupted.id,
        files,
        now + GENERATION_LIMITS.leaseMs,
      ),
    ).toBeNull();
    expect(
      store.getRun("alice", interrupted.id, now + GENERATION_LIMITS.leaseMs),
    ).toMatchObject({ status: "failed", error_code: "interrupted" });
    const next = reserve("alice", id, now + GENERATION_LIMITS.leaseMs);
    expect(next.id).not.toBe(interrupted.id);
    expect(
      store
        .runs("alice", id, now + 2 * GENERATION_LIMITS.leaseMs)
        .every((run) => run.status === "failed"),
    ).toBe(true);
  });
  it("rejects invalid or oversized source bundles before persistence", () => {
    const id = project();
    const run = reserve("alice", id);
    expect(() =>
      store.complete(
        "alice",
        run.id,
        [{ path: "../../secret", content: "bad" }],
        now,
      ),
    ).toThrow("invalid_request");
    expect(() =>
      store.complete(
        "alice",
        run.id,
        files.map((f) => ({ ...f, content: "x".repeat(200_000) })),
        now,
      ),
    ).toThrow("invalid_request");
    expect(store.versions("alice", id)).toEqual([]);
    expect(store.getRun("alice", run.id, now)?.status).toBe("running");
  });
  it("never persists raw provider error text", () => {
    const run = reserve("alice", project());
    store.fail("alice", run.id, "Authorization Bearer secret-value", now);
    expect(store.getRun("alice", run.id, now)?.error_code).toBe(
      "internal_error",
    );
  });
});
