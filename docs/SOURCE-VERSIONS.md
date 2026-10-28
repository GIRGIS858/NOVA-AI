# Source version service

This is an internal, tested prerequisite for AI generation. It does not call models, write files to the operating system, run generated code, serve previews, or deploy anything. There are no public mutation endpoints or editor controls yet.

## API

`sourceVersionStore(db)` returns:

- `list(ownerId, projectId)` — newest-first metadata, without loading file snapshots.
- `latest(ownerId, projectId)` — latest snapshot or `null`.
- `get(ownerId, projectId, versionId)` — one authorized snapshot.
- `commit(ownerId, projectId, input)` — atomically applies a structured change set.
- `restore(ownerId, projectId, input)` — appends a new snapshot based on an earlier version.

The application exports `sourceVersions` from `src/lib/db.ts`. Obtain `ownerId` from an authenticated server session, never the submitted payload. All methods check project ownership. Unknown and unauthorized projects share the same error.

Commit shape:

```ts
sourceVersions.commit(authenticatedUser.id, project.id, {
  baseVersionId: currentVersion?.id ?? null,
  summary: "Add a landing page",
  changes: [
    {
      type: "write",
      path: "src/app/page.tsx",
      content: "export default function Page() { return <h1>Hello</h1>; }",
    },
  ],
});
```

Restore shape:

```ts
sourceVersions.restore(authenticatedUser.id, project.id, {
  baseVersionId: currentVersion.id,
  versionId: targetVersion.id,
  summary: "Restore an earlier design",
});
```

## Consistency

SQLite `BEGIN IMMEDIATE` serializes writers. The latest version is checked inside that transaction. A stale `baseVersionId` produces `SourceVersionError` with code `CONFLICT`; callers must reload and reconcile changes, not silently retry against a new base. Snapshots and project update times commit together. Failed change sets do not create partial versions.

Snapshots are append-only through this service. Restoring adds a new version and retains the previous history. Deleting a project cascades to its history. Returned objects are detached JSON values, not mutable database references.

## Boundaries

- ASCII relative paths with supported web-source extensions.
- Reject absolute paths, traversal, backslashes, hidden paths, reserved Windows device names, credential locations, dependency/output directories, and unsupported file types.
- Reject case-only path collisions for Windows portability.
- Reject binary NUL text, repeated changes to a path, and deletion of missing files.
- At most 200 files/changes, 256 KiB UTF-8 per file, 2 MiB per snapshot, and 128 versions per project.
- All limits are centralized in `SOURCE_LIMITS` and enforced before insertion.

Path validation is not code safety, secret scanning, or execution authorization. HTML, SVG, and JavaScript remain untrusted. Future previews must execute on a separately isolated origin/runtime and must never receive platform secrets. Content may still contain sensitive text despite safe filenames; future AI context construction must exclude secrets by design.

## Schema and tests

Run `npm run db:migrate`; `migrateSourceVersions(db)` creates the initial schema repeatably. Future schema changes require explicit migrations.

Tests cover immutable edit/delete/restore history, project ownership, cross-project restore rejection, path constraints, rollback, byte/file/history limits, cascading project deletion, and stale edits across two independent SQLite connections.

## Next integration

Add durable authorized generation runs and a provider adapter. Capture the base source version before requesting a change set; pass the result through this service. A provider response is untrusted input. Then build an isolated runner and verify its output before exposing a preview. Do not run application code inside Nova's web process.
