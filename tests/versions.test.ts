import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { projectStore } from "../src/lib/projects";
import {
  migrateSourceVersions,
  sourceVersionStore,
  validateSourcePath,
  SOURCE_LIMITS,
} from "../src/lib/versions";

describe("source versions", () => {
  let db: Database.Database;
  let project: string;
  let sources: ReturnType<typeof sourceVersionStore>;
  beforeEach(() => {
    db = new Database(":memory:");
    db.pragma("foreign_keys = ON");
    project = projectStore(db).create("alice", {
      name: "Website",
      brief: "A website for a small studio",
    });
    migrateSourceVersions(db);
    sources = sourceVersionStore(db);
  });
  afterEach(() => db.close());
  const change = (
    content = "export default function Home() { return 'Hello'; }",
  ) => ({ type: "write", path: "src/app/page.tsx", content });
  const first = () =>
    sources.commit("alice", project, {
      baseVersionId: null,
      summary: "Initial source",
      changes: [change()],
    });
  it("preserves previous versions when editing, deleting, and restoring", () => {
    const initial = first();
    const updated = sources.commit("alice", project, {
      baseVersionId: initial.id,
      summary: "Change heading",
      changes: [change("New heading")],
    });
    expect(
      sources.get("alice", project, initial.id).files[0].content,
    ).toContain("Hello");
    const deleted = sources.commit("alice", project, {
      baseVersionId: updated.id,
      summary: "Delete page",
      changes: [{ type: "delete", path: "src/app/page.tsx" }],
    });
    expect(deleted.files).toEqual([]);
    const restored = sources.restore("alice", project, {
      baseVersionId: deleted.id,
      versionId: initial.id,
      summary: "Restore first source",
    });
    expect(restored.files).toEqual(initial.files);
    expect(restored.number).toBe(4);
    expect(restored.restoredFrom).toBe(initial.id);
    expect(sources.list("alice", project)).toHaveLength(4);
  });
  it("rejects foreign users and cross-project restore targets", () => {
    const initial = first();
    for (const operation of [
      () => sources.list("bob", project),
      () => sources.latest("bob", project),
      () => sources.get("bob", project, initial.id),
      () =>
        sources.commit("bob", project, {
          baseVersionId: initial.id,
          summary: "Attack",
          changes: [change()],
        }),
      () =>
        sources.restore("bob", project, {
          baseVersionId: initial.id,
          versionId: initial.id,
          summary: "Attack",
        }),
    ])
      expect(operation).toThrow("Project unavailable");
    const other = projectStore(db).create("alice", {
      name: "Other site",
      brief: "Another website for the studio",
    });
    expect(() =>
      sources.restore("alice", other, {
        baseVersionId: null,
        versionId: initial.id,
        summary: "Cross project",
      }),
    ).toThrow("Version unavailable");
  });
  it.each([
    "../secret.ts",
    "/app/page.tsx",
    "src/../../page.tsx",
    "src\\page.tsx",
    "src//page.tsx",
    ".env",
    "src/.env.local",
    ".git/config",
    "node_modules/pkg/index.js",
    "Secrets/key.json",
    "credentials.json",
    "src/%2e%2e/key.ts",
    "C:/app.ts",
    "src/NUL.txt",
    "src/foo./page.tsx",
    "script.sh",
  ])("rejects unsafe path %s", (path) => {
    expect(() => validateSourcePath(path)).toThrow();
  });
  it("accepts portable App Router source paths", () => {
    for (const path of [
      "src/app/(public)/page.tsx",
      "src/app/projects/[id]/page.tsx",
      "src/@shared/theme.css",
      "package.json",
      "public/logo.svg",
    ])
      expect(validateSourcePath(path)).toBe(path);
  });
  it("rolls back the entire change set after a late invalid operation", () => {
    const initial = first();
    const time = projectStore(db).get("alice", project)?.updated_at;
    expect(() =>
      sources.commit("alice", project, {
        baseVersionId: initial.id,
        summary: "Bad batch",
        changes: [change("Uncommitted"), { type: "delete", path: "absent.ts" }],
      }),
    ).toThrow();
    expect(sources.latest("alice", project)).toEqual(initial);
    expect(projectStore(db).get("alice", project)?.updated_at).toBe(time);
  });
  it("enforces byte, file-count, text, duplicate, and snapshot limits", () => {
    const commit = (changes: unknown[]) =>
      sources.commit("alice", project, {
        baseVersionId: null,
        summary: "Limits",
        changes,
      });
    expect(() =>
      commit([change("ع".repeat(SOURCE_LIMITS.fileBytes / 2 + 1))]),
    ).toThrow("byte limit");
    expect(() => commit([change("binary\0value")])).toThrow("text source");
    expect(() => commit([change(), change()])).toThrow("only once");
    expect(() =>
      commit([
        { type: "write", path: "src/A.ts", content: "a" },
        { type: "write", path: "src/a.ts", content: "b" },
      ]),
    ).toThrow();
    expect(() =>
      commit(
        Array.from({ length: 201 }, (_, i) => ({
          type: "write",
          path: `src/f${i}.ts`,
          content: "a",
        })),
      ),
    ).toThrow();
    expect(() =>
      commit(
        Array.from({ length: 9 }, (_, i) => ({
          type: "write",
          path: `src/f${i}.ts`,
          content: "a".repeat(SOURCE_LIMITS.fileBytes),
        })),
      ),
    ).toThrow("snapshot exceeds");
    expect(sources.latest("alice", project)).toBeNull();
  });
  it("cascades history deletion with its owning project", () => {
    first();
    projectStore(db).remove("alice", project);
    expect(
      db.prepare("SELECT COUNT(*) AS count FROM source_versions").get(),
    ).toEqual({ count: 0 });
  });
  it("uses database state to reject stale saves across independent connections", () => {
    const dir = mkdtempSync(join(tmpdir(), "nova-versions-"));
    const path = join(dir, "test.sqlite");
    const a = new Database(path);
    const b = new Database(path);
    try {
      a.pragma("journal_mode = WAL");
      const p = projectStore(a).create("alice", {
        name: "Shared",
        brief: "A shared source project",
      });
      migrateSourceVersions(a);
      const s1 = sourceVersionStore(a);
      const s2 = sourceVersionStore(b);
      const v = s1.commit("alice", p, {
        baseVersionId: null,
        summary: "First",
        changes: [change()],
      });
      expect(s2.latest("alice", p)?.id).toBe(v.id);
      const next = s1.commit("alice", p, {
        baseVersionId: v.id,
        summary: "Winner",
        changes: [change("Winner")],
      });
      expect(() =>
        s2.commit("alice", p, {
          baseVersionId: v.id,
          summary: "Stale",
          changes: [change("Loser")],
        }),
      ).toThrow("Reload its latest version");
      expect(() =>
        s2.restore("alice", p, {
          baseVersionId: v.id,
          versionId: v.id,
          summary: "Stale restore",
        }),
      ).toThrow("Reload its latest version");
      expect(s2.latest("alice", p)?.id).toBe(next.id);
    } finally {
      b.close();
      a.close();
      rmSync(dir, { recursive: true, force: true });
    }
  });
  it("enforces a bounded immutable history", () => {
    let base: string | null = null;
    for (let i = 0; i < SOURCE_LIMITS.versions; i++) {
      base = sources.commit("alice", project, {
        baseVersionId: base,
        summary: `Version ${i}`,
        changes: [change(String(i))],
      }).id;
    }
    expect(() =>
      sources.commit("alice", project, {
        baseVersionId: base,
        summary: "Overflow",
        changes: [change()],
      }),
    ).toThrow("history limit");
    expect(sources.list("alice", project)).toHaveLength(SOURCE_LIMITS.versions);
  });
});
