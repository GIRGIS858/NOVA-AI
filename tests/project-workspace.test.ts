import { afterEach, beforeEach, describe, expect, it } from "vitest";
import Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { projectStore } from "../src/lib/projects";
import {
  migrateSourceVersions,
  SOURCE_LIMITS,
  sourceVersionStore,
} from "../src/lib/versions";
import {
  projectWorkspaceStore,
  WORKSPACE_REQUEST_BYTES,
} from "../src/lib/project-workspace";
import { FULLSTACK_TEMPLATE_FILES } from "../src/lib/fullstack-template";

const files = (content = "export const title = 'مرحبا 🌙';\r\n") => [
  { path: "src/App.tsx", content },
  { path: "package.json", content: '{"name":"application"}\n' },
];

describe("multi-file project workspace", () => {
  let db: Database.Database;
  let project: string;
  let workspace: ReturnType<typeof projectWorkspaceStore>;
  let sources: ReturnType<typeof sourceVersionStore>;
  beforeEach(() => {
    db = new Database(":memory:");
    db.pragma("foreign_keys = ON");
    project = projectStore(db).create("alice", {
      name: "Workspace",
      brief: "A full-stack application workspace",
    });
    migrateSourceVersions(db);
    workspace = projectWorkspaceStore(db);
    sources = sourceVersionStore(db);
  });
  afterEach(() => db.close());
  const first = () =>
    workspace.save("alice", project, { baseVersionId: null, files: files() });

  it("returns an empty owner-scoped workspace and canonical history metadata", () => {
    expect(workspace.read("alice", project)).toEqual({
      version: null,
      versions: [],
      latestVersionId: null,
      limits: SOURCE_LIMITS,
    });
    const initial = first();
    expect(workspace.read("alice", project)).toEqual({
      version: initial,
      versions: sources.list("alice", project),
      latestVersionId: initial.id,
      limits: SOURCE_LIMITS,
    });
  });
  it("replaces files atomically and retains original source and version numbers", () => {
    const initial = first();
    const edited = workspace.save("alice", project, {
      baseVersionId: initial.id,
      files: [
        {
          path: "src/app.tsx",
          content: "export default () => <h1>Updated</h1>;",
        },
        { path: "server/index.mjs", content: "// A new backend file" },
      ],
    });
    expect(edited.number).toBe(2);
    expect(edited.baseVersionId).toBe(initial.id);
    expect(edited.files.map((file) => file.path)).toEqual([
      "server/index.mjs",
      "src/app.tsx",
    ]);
    expect(workspace.read("alice", project, initial.id).version).toEqual(
      initial,
    );
    expect(workspace.read("alice", project, initial.id).latestVersionId).toBe(
      edited.id,
    );
  });
  it("supports case-only renames and replacing all 200 files in one snapshot", () => {
    const original = Array.from({ length: SOURCE_LIMITS.files }, (_, i) => ({
      path: `src/Old${i}.ts`,
      content: `${i}`,
    }));
    const initial = workspace.save("alice", project, {
      baseVersionId: null,
      files: original,
    });
    const renamed = workspace.save("alice", project, {
      baseVersionId: initial.id,
      files: original.map((file) => ({
        ...file,
        path: file.path.toLowerCase(),
      })),
    });
    const replaced = workspace.save("alice", project, {
      baseVersionId: renamed.id,
      files: original.map((file, i) => ({ ...file, path: `web/new${i}.ts` })),
    });
    expect(replaced.files).toHaveLength(200);
    expect(replaced.files.every((file) => file.path.startsWith("web/"))).toBe(
      true,
    );
    expect(sources.get("alice", project, initial.id).files).toEqual(
      initial.files,
    );
    expect(
      sources
        .get("alice", project, renamed.id)
        .files.every((file) => file.path === file.path.toLowerCase()),
    ).toBe(true);
  });
  it("can save deletion of every file and restore an earlier full snapshot", () => {
    const initial = first();
    const empty = workspace.save("alice", project, {
      baseVersionId: initial.id,
      files: [],
    });
    expect(empty.files).toEqual([]);
    const restored = workspace.restore("alice", project, {
      baseVersionId: empty.id,
      versionId: initial.id,
    });
    expect(restored.files).toEqual(initial.files);
    expect(restored.number).toBe(3);
    expect(restored.restoredFrom).toBe(initial.id);
    expect(sources.get("alice", project, empty.id).files).toEqual([]);
  });
  it("refuses no-op snapshots regardless of file ordering", () => {
    const initial = first();
    expect(() =>
      workspace.save("alice", project, {
        baseVersionId: initial.id,
        files: [...initial.files].reverse(),
      }),
    ).toThrowError("unchanged");
    expect(sources.list("alice", project)).toHaveLength(1);
  });
  it("protects current edits from stale save, restore and initialization requests", () => {
    const initial = first();
    const edited = workspace.save("alice", project, {
      baseVersionId: initial.id,
      files: files("Newer content"),
    });
    expect(() =>
      workspace.save("alice", project, {
        baseVersionId: initial.id,
        files: files("Stale draft"),
      }),
    ).toThrowError("conflict");
    expect(() =>
      workspace.restore("alice", project, {
        baseVersionId: initial.id,
        versionId: initial.id,
      }),
    ).toThrowError("conflict");
    expect(() =>
      workspace.template("alice", project, { baseVersionId: null }),
    ).toThrowError("conflict");
    expect(sources.latest("alice", project)).toEqual(edited);
    expect(sources.list("alice", project)).toHaveLength(2);
  });
  it("initializes the reviewed frontend/backend template only on a project with no versions", () => {
    const template = workspace.template("alice", project, {
      baseVersionId: null,
    });
    expect(template.files).toEqual(
      [...FULLSTACK_TEMPLATE_FILES].sort((a, b) => (a.path < b.path ? -1 : 1)),
    );
    expect(template.files.map((file) => file.path)).toEqual(
      expect.arrayContaining([
        "package.json",
        "web/main.jsx",
        "server/app.mjs",
        "README.md",
      ]),
    );
    const empty = workspace.save("alice", project, {
      baseVersionId: template.id,
      files: [],
    });
    expect(() =>
      workspace.template("alice", project, { baseVersionId: null }),
    ).toThrowError("conflict");
    expect(sources.latest("alice", project)).toEqual(empty);
  });
  it("authorizes all operations before parsing malformed input and hides unknown projects", () => {
    first();
    for (const [owner, target] of [
      ["bob", project],
      ["alice", randomUUID()],
    ]) {
      for (const operation of [
        workspace.save,
        workspace.restore,
        workspace.template,
      ])
        expect(() => operation(owner, target, null)).toThrowError(
          "unavailable",
        );
      expect(() => workspace.read(owner, target, "invalid")).toThrowError(
        "unavailable",
      );
      expect(() => workspace.export(owner, target, "invalid")).toThrowError(
        "unavailable",
      );
    }
    expect(sources.list("alice", project)).toHaveLength(1);
  });
  it("scopes selected source, restore and ZIP targets to their project", () => {
    const other = projectStore(db).create("alice", {
      name: "Other",
      brief: "Another project owned by the same account",
    });
    const foreign = workspace.save("alice", other, {
      baseVersionId: null,
      files: files(),
    });
    expect(() => workspace.read("alice", project, foreign.id)).toThrowError(
      "unavailable",
    );
    expect(() => workspace.export("alice", project, foreign.id)).toThrowError(
      "unavailable",
    );
    expect(() =>
      workspace.restore("alice", project, {
        baseVersionId: null,
        versionId: foreign.id,
      }),
    ).toThrowError("unavailable");
    expect(sources.list("alice", project)).toEqual([]);
  });
  it("exports the explicitly selected immutable snapshot", () => {
    const initial = first();
    workspace.save("alice", project, {
      baseVersionId: initial.id,
      files: files("A newer version"),
    });
    const exported = workspace.export("alice", project, initial.id);
    expect(exported.version).toEqual(initial);
    expect(exported.archive.includes(Buffer.from(files()[0].content))).toBe(
      true,
    );
    expect(exported.archive.includes(Buffer.from("A newer version"))).toBe(
      false,
    );
  });
  it.each([
    { baseVersionId: "invalid", files: files() },
    { baseVersionId: null, files: files(), owner: "bob" },
    { baseVersionId: null, files: [{ path: "src/App.tsx", content: 123 }] },
    {
      baseVersionId: null,
      files: [{ path: "src/App.tsx", content: "", executable: true }],
    },
  ])("rejects malformed or unexpected save input", (input) => {
    expect(() => workspace.save("alice", project, input)).toThrowError(
      "invalid_request",
    );
    expect(sources.latest("alice", project)).toBeNull();
  });
  it.each([
    "../outside.ts",
    "/absolute.ts",
    ".env",
    "src\\outside.ts",
    "node_modules/pkg/index.js",
    "data/private.json",
    "CON.txt",
    "program.exe",
  ])("rejects unsupported paths without partial writes: %s", (path) => {
    expect(() =>
      workspace.save("alice", project, {
        baseVersionId: null,
        files: [...files(), { path, content: "bad" }],
      }),
    ).toThrowError("invalid_path");
    expect(sources.latest("alice", project)).toBeNull();
  });
  it.each([
    ["src/App.tsx", "SRC/app.tsx"],
    ["app.ts", "APP.ts/nested.ts"],
    ["APP.ts/nested.ts", "app.ts"],
  ])(
    "rejects portable duplicate and directory/file collisions: %s, %s",
    (first, second) => {
      expect(() =>
        workspace.save("alice", project, {
          baseVersionId: null,
          files: [
            { path: first, content: "1" },
            { path: second, content: "2" },
          ],
        }),
      ).toThrowError("invalid_change");
      expect(sources.latest("alice", project)).toBeNull();
    },
  );
  it("enforces UTF-8 file, aggregate and file-count limits without persisting partial data", () => {
    const invalid = [
      [{ path: "a.ts", content: "ع".repeat(SOURCE_LIMITS.fileBytes / 2 + 1) }],
      [{ path: "a.ts", content: "a".repeat(SOURCE_LIMITS.fileBytes + 1) }],
      Array.from({ length: 9 }, (_, i) => ({
        path: `${i}.ts`,
        content: "a".repeat(SOURCE_LIMITS.fileBytes),
      })),
      Array.from({ length: SOURCE_LIMITS.files + 1 }, (_, i) => ({
        path: `${i}.ts`,
        content: "",
      })),
    ];
    for (const source of invalid)
      expect(() =>
        workspace.save("alice", project, {
          baseVersionId: null,
          files: source,
        }),
      ).toThrowError("source_limit");
    expect(() =>
      workspace.save("alice", project, {
        baseVersionId: null,
        files: [{ path: "a.ts", content: "binary\0data" }],
      }),
    ).toThrowError("invalid_change");
    expect(sources.latest("alice", project)).toBeNull();
  });
  it("accepts a maximal source with JSON escaping inside the HTTP payload budget", () => {
    const source = Array.from({ length: 8 }, (_, i) => ({
      path: `src/${i}.ts`,
      content: "\u0001".repeat(SOURCE_LIMITS.fileBytes),
    }));
    const input = { baseVersionId: null, files: source };
    expect(Buffer.byteLength(JSON.stringify(input))).toBeLessThanOrEqual(
      WORKSPACE_REQUEST_BYTES,
    );
    const version = workspace.save("alice", project, input);
    expect(version.totalBytes).toBe(SOURCE_LIMITS.totalBytes);
    expect(version.files).toEqual(source);
  });
  it("retains the canonical immutable history cap for saves and restores", () => {
    const initial = first();
    let latest = initial;
    for (let i = 1; i < SOURCE_LIMITS.versions; i++)
      latest = workspace.save("alice", project, {
        baseVersionId: latest.id,
        files: files(`Version ${i}`),
      });
    expect(() =>
      workspace.save("alice", project, {
        baseVersionId: latest.id,
        files: files("Overflow"),
      }),
    ).toThrowError("source_limit");
    expect(() =>
      workspace.restore("alice", project, {
        baseVersionId: latest.id,
        versionId: initial.id,
      }),
    ).toThrowError("source_limit");
    expect(sources.list("alice", project)).toHaveLength(SOURCE_LIMITS.versions);
  });
  it("checks the current base through independent database connections and preserves it across reopening", () => {
    const dir = mkdtempSync(join(tmpdir(), "nova-workspace-"));
    const path = join(dir, "test.sqlite");
    const a = new Database(path);
    const b = new Database(path);
    try {
      a.pragma("journal_mode = WAL");
      const target = projectStore(a).create("alice", {
        name: "Shared",
        brief: "A source workspace with concurrent clients",
      });
      migrateSourceVersions(a);
      const one = projectWorkspaceStore(a);
      const two = projectWorkspaceStore(b);
      const initial = one.save("alice", target, {
        baseVersionId: null,
        files: files(),
      });
      const edited = two.save("alice", target, {
        baseVersionId: initial.id,
        files: files("Winner"),
      });
      expect(() =>
        one.save("alice", target, {
          baseVersionId: initial.id,
          files: files("Loser"),
        }),
      ).toThrowError("conflict");
      expect(() =>
        one.restore("alice", target, {
          baseVersionId: initial.id,
          versionId: initial.id,
        }),
      ).toThrowError("conflict");
      const reopened = new Database(path);
      try {
        expect(
          projectWorkspaceStore(reopened).read("alice", target).version,
        ).toEqual(edited);
      } finally {
        reopened.close();
      }
    } finally {
      b.close();
      a.close();
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
