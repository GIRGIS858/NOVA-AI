# Source version service

This is an internal, tested prerequisite for AI generation. It does not call models, write files to the operating system, run generated code, serve previews, or deploy anything. Generation and the manual static editor now commit through this service. Owner-scoped read endpoints expose generated, manually edited and restored versions. The public mutation boundary supports static HTML/CSS only. See GENERATION.md.

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

## Static editor HTTP integration

- `POST /api/projects/:id/source`: JSON `{baseVersionId: UUID | null, files: [{path, content}, ...]}`; creates an immutable version after file and sanitized-preview validation. JSON is bounded to 768 KiB before parsing; decoded files remain limited to 100 KiB/file and 120 KiB total.
- `POST /api/projects/:id/source/restore`: JSON `{baseVersionId: UUID | null, versionId: UUID}`; validates the target and appends a restored version. Previous versions remain intact.
- Both writes require an authenticated project owner and exact configured Origin. They do not call an AI provider or consume generation attempts. Missing sessions return 401, other owners 404, invalid origin 403, stale base 409, malformed input 400, unsupported/invalid static output 422.
- History reads include all canonical snapshots, with stable version numbers and restore provenance. Preview/source reads remain owner-scoped.

The editor captures its base on opening and never silently rebases. A conflicting save preserves the on-page draft and offers JSON download; the user can reconcile with the latest source. The draft is not autosaved. Full reload/close warns when dirty, and explicit editor closure asks before discarding; ordinary application navigation can discard an unsaved in-memory draft. Save before navigating.

Browser coverage exercises create → edit → restore, retained earlier content, a concurrent session save, draft preservation on conflict, invalid/oversized bodies, cross-origin and cross-account rejection, and mobile Arabic/English layouts. Fixtures contain manually supplied source and do not imply live AI validation.

## Next integration

Include the captured source version in AI edit context with explicit limits. Build a separately isolated runner for JavaScript/full-stack execution and verify readiness before exposing it. Never run generated application code inside Nova's web process.
