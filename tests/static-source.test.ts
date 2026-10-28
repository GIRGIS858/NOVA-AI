import { beforeEach, afterEach, describe, expect, it } from "vitest";
import Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import { projectStore } from "../src/lib/projects";
import {
  migrateSourceVersions,
  sourceVersionStore,
  SOURCE_LIMITS,
} from "../src/lib/versions";
import { staticSourceStore } from "../src/lib/static-source";

const files = (heading = "First version") => [
  { path: "index.html", content: `<main><h1>${heading}</h1></main>` },
  { path: "styles.css", content: "body{color:teal}" },
];

describe("manual static source operations", () => {
  let db: Database.Database;
  let projectId: string;
  let sources: ReturnType<typeof sourceVersionStore>;
  let editor: ReturnType<typeof staticSourceStore>;
  beforeEach(() => {
    db = new Database(":memory:");
    db.pragma("foreign_keys = ON");
    projectId = projectStore(db).create("alice", {
      name: "Studio",
      brief: "A static studio portfolio",
    });
    migrateSourceVersions(db);
    sources = sourceVersionStore(db);
    editor = staticSourceStore(db);
  });
  afterEach(() => db.close());
  const first = () =>
    editor.save("alice", projectId, { baseVersionId: null, files: files() });

  it("creates and edits snapshots without changing previous files", () => {
    const initial = first();
    const edited = editor.save("alice", projectId, {
      baseVersionId: initial.id,
      files: files("Updated heading"),
    });
    expect(edited.number).toBe(2);
    expect(edited.baseVersionId).toBe(initial.id);
    expect(edited.files).toEqual(files("Updated heading"));
    expect(sources.get("alice", projectId, initial.id).files).toEqual(files());
    expect(sources.list("alice", projectId)).toHaveLength(2);
  });
  it("restores an old snapshot as a new immutable version", () => {
    const initial = first();
    const edited = editor.save("alice", projectId, {
      baseVersionId: initial.id,
      files: files("Second version"),
    });
    const restored = editor.restore("alice", projectId, {
      baseVersionId: edited.id,
      versionId: initial.id,
    });
    expect(restored.number).toBe(3);
    expect(restored.id).not.toBe(initial.id);
    expect(restored.restoredFrom).toBe(initial.id);
    expect(restored.files).toEqual(initial.files);
    expect(sources.get("alice", projectId, edited.id).files).toEqual(
      edited.files,
    );
  });
  it("authorizes before inspecting malformed input and hides unknown projects", () => {
    for (const operation of [editor.save, editor.restore]) {
      expect(() => operation("bob", projectId, null)).toThrowError(
        "unavailable",
      );
      expect(() => operation("alice", randomUUID(), null)).toThrowError(
        "unavailable",
      );
    }
    expect(sources.list("alice", projectId)).toHaveLength(0);
  });
  it("rejects stale save and restore bases without replacing newer edits", () => {
    const initial = first();
    const edited = editor.save("alice", projectId, {
      baseVersionId: initial.id,
      files: files("Newer edit"),
    });
    expect(() =>
      editor.save("alice", projectId, {
        baseVersionId: initial.id,
        files: files("Stale draft"),
      }),
    ).toThrowError("conflict");
    expect(() =>
      editor.restore("alice", projectId, {
        baseVersionId: initial.id,
        versionId: initial.id,
      }),
    ).toThrowError("conflict");
    expect(sources.latest("alice", projectId)?.id).toBe(edited.id);
    expect(sources.list("alice", projectId)).toHaveLength(2);
  });
  it("rejects cross-project restore targets", () => {
    const foreign = projectStore(db).create("alice", {
      name: "Other",
      brief: "A different static project",
    });
    const version = editor.save("alice", foreign, {
      baseVersionId: null,
      files: files(),
    });
    expect(() =>
      editor.restore("alice", projectId, {
        baseVersionId: null,
        versionId: version.id,
      }),
    ).toThrowError("unavailable");
    expect(sources.list("alice", projectId)).toHaveLength(0);
  });
  it.each([
    [{ path: "../../index.html", content: "<h1>Escape</h1>" }, files()[1]],
    [{ path: "index.html", content: "<script>alert(1)</script>" }, files()[1]],
    [{ path: "index.html", content: "<div></div>" }, files()[1]],
    [{ path: "index.html", content: "a".repeat(102401) }, files()[1]],
    [
      { path: "index.html", content: "<h1>Page</h1>" },
      { path: "index.html", content: "duplicate" },
    ],
  ])(
    "rejects invalid static artifacts without writing a version",
    (...invalidFiles) => {
      expect(() =>
        editor.save("alice", projectId, {
          baseVersionId: null,
          files: invalidFiles,
        }),
      ).toThrowError("invalid_output");
      expect(sources.list("alice", projectId)).toHaveLength(0);
    },
  );
  it("rejects unexpected fields and invalid base identifiers", () => {
    expect(() =>
      editor.save("alice", projectId, {
        baseVersionId: null,
        files: files(),
        owner: "bob",
      }),
    ).toThrowError("invalid_request");
    expect(() =>
      editor.save("alice", projectId, {
        baseVersionId: "invalid",
        files: files(),
      }),
    ).toThrowError("invalid_request");
    expect(() =>
      editor.restore("alice", projectId, {
        baseVersionId: null,
        versionId: randomUUID(),
        extra: true,
      }),
    ).toThrowError("invalid_request");
    expect(sources.list("alice", projectId)).toHaveLength(0);
  });
  it("does not overwrite or remove files from an unsupported application snapshot", () => {
    const app = sources.commit("alice", projectId, {
      baseVersionId: null,
      summary: "Existing app",
      changes: [
        {
          type: "write",
          path: "src/app.tsx",
          content: "export const App = 1;",
        },
      ],
    });
    expect(() =>
      editor.save("alice", projectId, {
        baseVersionId: app.id,
        files: files(),
      }),
    ).toThrowError("unsupported_source");
    expect(() =>
      editor.restore("alice", projectId, {
        baseVersionId: app.id,
        versionId: app.id,
      }),
    ).toThrowError("unsupported_source");
    expect(sources.latest("alice", projectId)).toEqual(app);
  });
  it("validates restore artifacts and does not promote unsafe historical output", () => {
    const unsafe = sources.commit("alice", projectId, {
      baseVersionId: null,
      summary: "Legacy static source",
      changes: [
        {
          type: "write",
          path: "index.html",
          content: "<script>bad()</script>",
        },
        { type: "write", path: "styles.css", content: "" },
      ],
    });
    const safe = editor.save("alice", projectId, {
      baseVersionId: unsafe.id,
      files: files(),
    });
    expect(() =>
      editor.restore("alice", projectId, {
        baseVersionId: safe.id,
        versionId: unsafe.id,
      }),
    ).toThrowError("invalid_output");
    expect(sources.latest("alice", projectId)?.id).toBe(safe.id);
    expect(sources.list("alice", projectId)).toHaveLength(2);
  });
  it("retains the canonical history limit for saves and restores", () => {
    let latest = first();
    const initial = latest;
    for (let i = 1; i < SOURCE_LIMITS.versions; i++)
      latest = editor.save("alice", projectId, {
        baseVersionId: latest.id,
        files: files(`Version ${i + 1}`),
      });
    expect(() =>
      editor.save("alice", projectId, {
        baseVersionId: latest.id,
        files: files("Too many"),
      }),
    ).toThrowError("source_limit");
    expect(() =>
      editor.restore("alice", projectId, {
        baseVersionId: latest.id,
        versionId: initial.id,
      }),
    ).toThrowError("source_limit");
    expect(sources.list("alice", projectId)).toHaveLength(
      SOURCE_LIMITS.versions,
    );
  });
});
