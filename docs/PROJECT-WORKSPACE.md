# Multi-file project workspace

Open **Project files** from a project's studio. The Arabic/English workspace manages text files in the same immutable source history used by the static editor and generation worker. It does not install dependencies or execute project code.

## Editing and recovery

- Browse nested folders; create, edit, rename and delete files in an in-memory draft.
- **Save version** submits the complete snapshot against its captured base. Saves and restores check ownership and the current version in an immediate SQLite transaction. A concurrent update returns 409 and leaves the local draft and its original base intact.
- Historical versions are read-only. **Restore as new version** appends their complete source without changing old snapshots.
- **Download draft JSON** includes unsaved edits and the captured base. **Download saved ZIP** includes exactly the selected saved version, without unsaved changes. Opening the latest version requires confirmation when the draft is dirty.
- Drafts are page memory only. Save or download before leaving. Links and full-page unload warn about unsaved edits; browser history and client-side transitions are not a persistent recovery mechanism.

Limits are 200 files, 256 KiB UTF-8 per file, 2 MiB source per snapshot and 128 versions per project. File paths must be portable relative paths with supported text extensions. Hidden files, traversal, reserved directories, common credential filenames, duplicate paths and file/directory collisions are rejected. Path rules are not a secret scanner: never paste credentials into source. Case-only renames and replacement of all 200 files work atomically.

## Reviewed React and Node starter

An empty project can create one starter snapshot containing a React/Vite frontend, a separate Node HTTP notes API, a dependency manifest and lockfile, API tests and a README. Export it, review its source, then use Node 22 and `npm ci`. Its README gives the two local development commands and build/test commands. The development services bind to loopback.

The starter demonstrates a real browser/API round trip. Notes are held in process memory and disappear after API restart; authentication, a persistent application database and deployment remain future work. The bundled template was tested separately as reviewed repository code. This does not establish an execution boundary for arbitrary edited or generated applications.

The current AI generator and sandboxed preview support exactly `index.html` and `styles.css`. A project with other source files opens through this workspace; its studio describes the pending full-stack build and AI support. No full-stack preview or deployment success is implied.

## HTTP boundary

All routes under `/api/projects/:id/workspace` authenticate the owner; missing and foreign projects return the same 404. Mutations also require the configured Origin and bounded JSON. Private responses disable caching.

| Method / suffix | Request | Result |
| --- | --- | --- |
| GET | Optional `?version=<uuid>` | Selected source, version metadata, latest ID and limits |
| POST | `{baseVersionId, files}` | New full snapshot |
| POST `/restore` | `{baseVersionId, versionId}` | Restored snapshot as a new version |
| POST `/template` | `{baseVersionId: null}` | Starter only when no saved version exists |
| GET `/export` | Required `?version=<uuid>` | Complete saved ZIP attachment |

ZIPs are bounded, generated in memory, and contain regular files with original UTF-8 contents and validated paths. The exporter never extracts archives or writes source to an executable filesystem. A downloaded archive contains untrusted source; saving/exporting does not review user edits or make them safe to run. Manual source operations do not reserve AI quota.
