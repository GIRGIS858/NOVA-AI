import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import { projectStore } from "../src/lib/projects";
import { migrateSourceVersions } from "../src/lib/versions";
import { migrateGeneration } from "../src/lib/generation-store";
import { generationStore } from "../src/lib/generation-store";
import { runGeneration } from "../src/lib/run-generation";
import { ProviderError, type generateStaticSite } from "../src/lib/ai-provider";
const files = [
  { path: "index.html", content: "<h1>Fixture website</h1>" },
  { path: "styles.css", content: "h1{color:teal}" },
];
describe("generation lifecycle with fixture provider", () => {
  let db: Database.Database;
  let projects: ReturnType<typeof projectStore>;
  let generations: ReturnType<typeof generationStore>;
  let projectId: string;
  beforeEach(() => {
    db = new Database(":memory:");
    db.pragma("foreign_keys = ON");
    projects = projectStore(db);
    migrateSourceVersions(db);
    migrateGeneration(db);
    generations = generationStore(db);
    projectId = projects.create("alice", {
      name: "Portfolio",
      brief: "A studio portfolio website",
    });
  });
  afterEach(() => db.close());
  const input = () => ({
    owner: "alice",
    projectId,
    requestId: randomUUID(),
    apiKey: "test-only",
    signal: new AbortController().signal,
  });
  it("persists a bounded source version and replays the same request without calling provider again", async () => {
    for (let i = 0; i < 10; i++)
      projects.addMessage("alice", projectId, `note-${i}`);
    const provider = vi
      .fn<typeof generateStaticSite>()
      .mockResolvedValue(files);
    const request = input();
    const result = await runGeneration(request, {
      projects,
      generations,
      provider,
    });
    expect(result.run?.status).toBe("succeeded");
    expect(generations.versions("alice", projectId)).toHaveLength(1);
    expect(provider.mock.calls[0][0].prompt).toContain("note-9");
    expect(provider.mock.calls[0][0].prompt).not.toContain("note-0");
    expect(provider.mock.calls[0][0].prompt).not.toContain("test-only");
    await runGeneration(request, { projects, generations, provider });
    expect(provider).toHaveBeenCalledTimes(1);
  });
  it("keeps the newest note when context exceeds the provider prompt budget", async () => {
    projects.addMessage("alice", projectId, "A".repeat(8000));
    projects.addMessage("alice", projectId, "B".repeat(8000));
    projects.addMessage(
      "alice",
      projectId,
      "Newest requirement: use an Arabic navigation menu.",
    );
    const provider = vi
      .fn<typeof generateStaticSite>()
      .mockResolvedValue(files);
    await runGeneration(input(), { projects, generations, provider });
    const prompt = provider.mock.calls[0][0].prompt;
    expect(prompt.length).toBeLessThanOrEqual(16000);
    expect(prompt).toContain(
      "Newest requirement: use an Arabic navigation menu.",
    );
    expect(prompt).toContain("older content may be omitted");
  });
  it("does not contact the provider for an unauthorized project", async () => {
    const provider = vi.fn<typeof generateStaticSite>();
    await expect(
      runGeneration(
        { ...input(), owner: "bob" },
        { projects, generations, provider },
      ),
    ).rejects.toMatchObject({ code: "unavailable" });
    expect(provider).not.toHaveBeenCalled();
  });
  it("rejects unsafe file paths and records failure without storing a version", async () => {
    const provider = vi
      .fn<typeof generateStaticSite>()
      .mockResolvedValue([{ path: "../../server.js", content: "bad" }]);
    const result = await runGeneration(input(), {
      projects,
      generations,
      provider,
    });
    expect(result.run?.error_code).toBe("invalid_output");
    expect(generations.versions("alice", projectId)).toHaveLength(0);
  });
  it("cancellation wins over a late provider result and releases its concurrency lease", async () => {
    const provider: typeof generateStaticSite = async () => {
      const run = generations.runs("alice", projectId)[0];
      generations.cancel("alice", projectId, run.id);
      return files;
    };
    const result = await runGeneration(input(), {
      projects,
      generations,
      provider,
    });
    expect(result.run?.status).toBe("cancelled");
    expect(generations.versions("alice", projectId)).toHaveLength(0);
    expect(() =>
      generations.reserve("alice", projectId, randomUUID()),
    ).not.toThrow();
  });
  it("provider failure has a safe persisted code and no automatic retry", async () => {
    const provider = vi
      .fn<typeof generateStaticSite>()
      .mockRejectedValue(new ProviderError("provider_error"));
    const result = await runGeneration(input(), {
      projects,
      generations,
      provider,
    });
    expect(result.run?.error_code).toBe("provider_error");
    expect(provider).toHaveBeenCalledTimes(1);
    expect(generations.versions("alice", projectId)).toHaveLength(0);
  });
  it("deleted projects cannot be resurrected by a late provider result", async () => {
    const provider: typeof generateStaticSite = async () => {
      projects.remove("alice", projectId);
      return files;
    };
    await runGeneration(input(), { projects, generations, provider });
    expect(
      db.prepare("SELECT count(*) AS count FROM source_versions").get(),
    ).toEqual({ count: 0 });
    expect(
      db
        .prepare(
          "SELECT count(*) AS count FROM generation_attempts WHERE finished_at IS NULL",
        )
        .get(),
    ).toEqual({ count: 0 });
  });
});
