import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import { projectStore } from "../src/lib/projects";
import { migrateSourceVersions, sourceVersionStore } from "../src/lib/versions";
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
    expect(provider.mock.calls[0][0].source).toEqual({
      versionId: null,
      files: [],
    });
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
  it("sends complete latest manual/restored source while excluding other project data", async () => {
    const sources = sourceVersionStore(db);
    const first = sources.commit("alice", projectId, {
      baseVersionId: null,
      summary: "Manual source",
      changes: files.map((file) => ({ type: "write", ...file })),
    });
    const next = sources.commit("alice", projectId, {
      baseVersionId: first.id,
      summary: "Changed color",
      changes: [
        { type: "write", path: "styles.css", content: "h1{color:purple}" },
      ],
    });
    const restored = sources.restore("alice", projectId, {
      baseVersionId: next.id,
      versionId: first.id,
      summary: "Restore manual version",
    });
    const otherId = projects.create("bob", {
      name: "Private project",
      brief: "OTHER_OWNER_PRIVATE_CONTENT",
    });
    sources.commit("bob", otherId, {
      baseVersionId: null,
      summary: "Private",
      changes: [
        { type: "write", path: "private.txt", content: "OTHER_OWNER_SOURCE" },
      ],
    });
    projects.addMessage(
      "alice",
      projectId,
      "Change only the title color; keep the heading and layout.",
    );
    const provider = vi
      .fn<typeof generateStaticSite>()
      .mockResolvedValue(files);
    const result = await runGeneration(input(), {
      projects,
      generations,
      provider,
    });
    expect(result.run?.status).toBe("succeeded");
    const request = provider.mock.calls[0][0];
    expect(request.source).toEqual({ versionId: restored.id, files });
    expect(JSON.stringify(request)).not.toContain("OTHER_OWNER");
    expect(request.prompt).toContain("Change only the title color");
    expect(sources.get("alice", projectId, first.id).files).toEqual(files);
  });
  it("uses the reserved snapshot even when another edit commits before the provider starts", async () => {
    const sources = sourceVersionStore(db);
    const first = sources.commit("alice", projectId, {
      baseVersionId: null,
      summary: "Original",
      changes: files.map((file) => ({ type: "write", ...file })),
    });
    const reserve = generations.reserve.bind(generations);
    vi.spyOn(generations, "reserve").mockImplementationOnce((...args) => {
      const reservation = reserve(...args);
      sources.commit("alice", projectId, {
        baseVersionId: first.id,
        summary: "Concurrent edit",
        changes: [
          {
            type: "write",
            path: "index.html",
            content: "<h1>Keep concurrent edit</h1>",
          },
        ],
      });
      return reservation;
    });
    const provider = vi
      .fn<typeof generateStaticSite>()
      .mockResolvedValue([
        { path: "index.html", content: "<h1>Late AI output</h1>" },
        files[1],
      ]);
    const result = await runGeneration(input(), {
      projects,
      generations,
      provider,
    });
    expect(provider.mock.calls[0][0].source).toEqual({
      versionId: first.id,
      files,
    });
    expect(result.run?.error_code).toBe("conflict");
    expect(sources.latest("alice", projectId)?.files[0].content).toBe(
      "<h1>Keep concurrent edit</h1>",
    );
    expect(sources.list("alice", projectId)).toHaveLength(2);
  });
  it("rejects oversized encoded context without calling the provider or committing a partial version", async () => {
    const sources = sourceVersionStore(db);
    const original = sources.commit("alice", projectId, {
      baseVersionId: null,
      summary: "Large escaped content",
      changes: [
        {
          type: "write",
          path: "index.html",
          content: "<h1>Keep content</h1>" + "\u0001".repeat(60000),
        },
        { type: "write", ...files[1] },
      ],
    });
    const provider = vi.fn<typeof generateStaticSite>();
    const result = await runGeneration(input(), {
      projects,
      generations,
      provider,
    });
    expect(result.run?.error_code).toBe("context_limit");
    expect(provider).not.toHaveBeenCalled();
    expect(sources.latest("alice", projectId)).toEqual(original);
    expect(
      db
        .prepare(
          "SELECT COUNT(*) AS count FROM generation_attempts WHERE finished_at IS NULL",
        )
        .get(),
    ).toEqual({ count: 0 });
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
