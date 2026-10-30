# Nova — continuation handoff

## Current priority — local full-stack platform (30 October 2026)

The latest user direction supersedes the old OpenRouter-key prerequisite: build a substantial full-stack application platform with AI running on the user's own machine, without external provider keys. Hardware supplied: 16 GB RAM and RTX 5070; OS/exact VRAM/disk remain unknown. Read LOCAL-AI.md and PLATFORM-ROADMAP.md. The default runtime is now Ollama; OpenRouter survives only as explicit opt-in, never fallback. No model is installed in this cloud environment and no real local inference is claimed.

## User direction

Build a substantial full-stack AI website builder from scratch in this repository. Preserve the premium dark/cyan reference-inspired interface, orb, compact navigation, Arabic/English and RTL. The user explicitly requests **free AI only** and frequent tested GitHub checkpoints. A “strongest model” claim requires real comparative evidence; no such benchmark has run.

Fetch before pushing: more than one Codex session may change `main`. Preserve their commits; never force-push. Keep this file current so another session can resume without chat history.

## Current integrated checkpoint — 29 October 2026

Base includes `2b1486a` and all preceding concurrent milestones. Accounts, owner-scoped projects/notes, private session drafts, dark workspace, immutable source snapshots, static-generation runs, preview/source/history/download UI and manual-source save/restore service are retained; its HTTP/editor integration is now completed below.

Replaced the paid OpenAI adapter with **OpenRouter free-only inference**. `NOVA_AI_MODEL` defaults to `thinkingmachines/inkling:free`. The public catalog was checked today: zero prompt/completion prices and no listed expiration. Earlier candidate Laguna S 2.1 lists expiration on 31 October and is not the default. This is availability evidence, not live inference or a comparative quality benchmark.

Each request requires an explicit `:free` ID, a live catalog entry with all declared prices zero, zero token-price ceiling and disabled provider fallback. Missing/expired/unverifiable pricing blocks inference. Fixed HTTPS endpoints, normal TLS/proxy trust, bounded response streams and safe error codes protect secrets. JSON output is requested and validated locally; schema enforcement by the model is not assumed.

Current limits: 90-second operation, 12,000 output tokens, 16,000 prompt characters, 3 attempts/account and 20/environment per rolling 24 hours, 1 active/account and 3 globally. Attempts persist across project deletion; cancellation holds concurrency until acknowledged or a 120-second lease expires. Runs execute inside request lifetimes, not a durable background queue. No automatic retries.

Generation produces exactly `index.html` + `styles.css` from saved brief, latest notes and the complete captured source snapshot. Existing files use edit mode with preservation instructions; new projects use create mode. The whole encoded context is capped at 256 KiB UTF-8 and source is never truncated. Source commits capture the base and reject concurrent edits. The preview sanitizer and empty-sandbox iframe disable scripts, forms, external resources and parent access. Source downloads contain original untrusted code. This is a static HTML/CSS preview, not a full-stack application runner or public deployment.

## Verified evidence

- `npm run typecheck`: passed.
- `npm test`: 113 tests passed, including source-aware context, free-price guards and all retained source/store tests.
- `npm run build`: passed.
- `npm run test:e2e`: all 7 workflows passed against isolated production server/database. Includes ownership, cancellation, source download, mobile RTL/LTR and hostile iframe isolation.
- `npm run setup:local` and repeated `db:migrate`: verified in this environment.
- Provider/HTTP tests use fixtures. **No live inference has run; no AI credential is configured.**

The static browser test invokes the actual sanitizer through Node's TS loader in a subprocess because Playwright's custom loader cannot link sanitize-html's CJS-to-ESM dependency. It retains all hostile-content assertions.

## Secure activation prerequisite

Add an OpenRouter key securely in environment settings as `NOVA_AI_API_KEY`, targeting `openrouter.ai`. The saved requirement is named `NOVA_OPENROUTER_KEY`; a saved draft does not establish runtime readiness. Never request or expose keys in chat/source/logs.

Run `npm run ai:smoke` (one free-only request consuming quota), then set `NOVA_AI_ENABLED=1` and restart only after it passes. `NOVA_AI_MODEL` may select another explicit free ID; availability and free quotas can change. Hosted infrastructure is not guaranteed free. Read `docs/GENERATION.md` and README.

## Next work

1. Introduce a separately isolated application build runner for the new multi-file workspace, with resource/network limits, install/build/test jobs tied to immutable versions and real preview readiness. The generation worker does not execute generated source.
2. Extend structured AI operations to multi-file edits only after context, patch validation and execution boundaries are in place. The bundled React/Node starter currently uses JavaScript and in-memory notes; TypeScript and PostgreSQL provisioning remain planned.
3. Validate local Ollama inference and bilingual edit quality on the user's 16 GB RAM / RTX 5070 machine. No external provider key is required for that workflow.
4. Extend orchestration with bounded planning/repair steps and streaming events; coordinate any longer inference deadlines with lease recovery.
5. PostgreSQL, application data provisioning, deployment, teams, email verification/recovery and production operations remain on PLATFORM-ROADMAP.md.

## Starting another session

Use the existing checkout; no worktree unless requested. Activate Node 22 at `/workspace/toolchains/node22/node_modules/node/bin`, then `npm ci` and `npm run setup:local`. Read `AGENTS.md`, plan and architecture. Browser tests start their own server on port 3100; build first. Never point them at production.

Local `data/nova.sqlite` had an empty development-only generation table from the preserved `codex/free-ai-checkpoint` branch. It was backed up under ignored `data/` and renamed to `generation_runs_checkpoint_archive` before applying the canonical migration. Account and project data were retained. Do not merge that branch's alternate schema/UI wholesale into main; relevant free-only safeguards are integrated here.

The original free-generation work is preserved on GitHub at `codex/free-ai-checkpoint` (`1434a70`). Local secrets, databases, generated output and browser profiles remain ignored. Processes must restart after environment restoration. Localhost is not a published URL; work does not continue automatically between sessions.

## Latest milestone — manual source editor

Added `POST /api/projects/:id/source` and `/source/restore`, using the existing tested `staticSourceStore` from `2b1486a`. They require exact Origin and authenticated ownership, bound JSON before parsing, validate two supported static files and append through the canonical source store. The studio and history/read endpoints now include all canonical versions with actual version numbers and restore provenance.

Users can create HTML/CSS without a provider key, edit the latest version, download drafts and restore a historical version as a new snapshot. An editor captures its base at opening; background refresh cannot silently rebase it. A stale save returns 409 while retaining the local draft. Explicit close confirms discarding changes; full reload warns when dirty. Drafts remain in page memory, so save before application navigation. Manual saves consume no AI attempt quota.

New browser coverage exercises create/edit/restore, retained original snapshots, concurrent-save rejection, draft retention, cross-user/origin restrictions, invalid/oversized input, and mobile Arabic/English. Final validation: TypeScript, all 101 unit tests, production build and all 7 browser workflows passed. The new workflow uses manual fixture source and does not invoke AI. The initial browser attempt stalled on an exact label locator that included option text; the final check uses the accessible combobox role and retains all assertions.

## Latest milestone — source-aware AI context

Generation reservations now capture exact base-version files inside the transaction; subsequent source edits cannot silently change the data sent to AI. `generation-context.ts` validates static file shape, creates a JSON envelope, preserves full Unicode source and rejects oversized encoded payloads before a provider call. The system instruction distinguishes initial creation from edits and requests preservation of unrequested content/design. Actual model quality still awaits a credential and live validation; prior snapshots remain immutable. The UI explicitly discloses transmission of saved source alongside brief/notes.

Tests cover manual/restored input, concurrent edits between reservation and provider start, owner isolation, JSON escaping/UTF-8 limits, complete-file preservation and absence of server credentials in model messages. Checkpoint validation: TypeScript, all 113 unit tests, production build and all 7 browser workflows passed. No live provider inference was performed.

## Latest milestone — source comparison (30 October 2026)

Continued from GitHub main `191d52b` in a fresh restored cloud environment. Added an Arabic/English Compare versions view to the studio. Users choose a baseline and compare it to the selected saved version before restoring or downloading. The default baseline is the preceding version (or another saved version when viewing the oldest). Added/removed lines have explicit markers; unchanged files are identified. Loading failures can be retried, and obsolete requests are aborted when selection changes. Existing owner-scoped version endpoints remain the only data source. Source is rendered as escaped React text, never executed.

The line diff preserves Unicode and line endings, uses bounded LCS work, and falls back to a disclosed replacement block for large changes. Rendering is capped at 2,000 diff lines per file with a visible notice directing users to complete Source/JSON; original source remains intact. Tests reconstruct both inputs, cover repeated lines, newline-only changes, Arabic/emoji, large replacements and 150,000 blank lines. Browser coverage checks additions/removals, unchanged CSS, comparison baseline selection, English mobile layout and the existing restoration/ownership workflows.

Validation: Node 22.23.4, locked install and local migrations succeeded; type checking, 125 unit tests, production build and all 7 browser workflows passed. Live AI is still disabled and untested because no provider credential is configured. Existing saved environment install/start instructions remain applicable; no environment publication was performed by the agent.

## Latest milestone — local inference foundation

Added the Ollama adapter and made local inference the default. Configuration requires an explicit local model and enable flag, no API key. Calls target loopback port 11434 only, reject redirects and remote/cloud model metadata, bound input/response size, reject truncated outputs, and share the existing static artifact checks. Local requests never forward even a present remote credential. The studio now discloses the actual selected runtime. The live smoke command handles local models and does not activate them automatically.

The user's machine can start benchmarking a 7B quantized coding model; qwen2.5-coder:7b is a candidate, not a verified best model. The current local budget is 16K context, 4,096 output tokens and 10,000 serialized message bytes. The 90-second deadline/120-second lease and existing attempt quotas are unchanged. Real inference and performance validation remain pending on the user's machine. Do not expose their Ollama port publicly or assume cloud localhost refers to their laptop.

Next: complete the local hardware smoke/benchmark, then implement durable jobs with persisted progress, cancellation and lease recovery. Continue from PLATFORM-ROADMAP.md toward isolated full-stack builds, application data and deployment. The current generator still supports HTML/CSS only.

Validation for this checkpoint: type checking, all 137 unit tests (including an ephemeral real-HTTP fixture runtime), production build and all 7 browser workflows passed. The actual `ai:smoke` command was attempted with local provider/model selection and failed because the cloud environment has no reachable local model runtime; no real generation success is claimed. Saved startup instructions were updated in the environment draft for local-first operation; they were not published. The existing install script remains applicable.

## Latest milestone — durable generation worker (30 October 2026)

Generation now returns a persisted queued job (HTTP 202; idempotent replay 200). Captured source, requirements, provider/model and reservation are written atomically. `npm run worker` performs generation in a separate Node process, so browser disconnection does not cancel accepted work. The studio displays queued/generating/validating/terminal stages in Arabic/English and follows the newly saved version after completion. Provider output still supports HTML/CSS only and is never executed.

Claim tokens and immediate SQLite transactions prevent duplicate claims and stale publication. Queued jobs wait up to ten minutes; claiming grants a fresh 120-second lease around a 90-second inference deadline. Expired/crashed work is marked interrupted, with no automatic retry of ambiguous provider calls. Private job payloads are cleared at settlement; status events contain only phases/timestamps. Provider configuration changes fail safely instead of rerouting private data.

A retained attempt deadline survives project/job deletion, including jobs claimed after a long queue wait. Deleting an unclaimed job releases its slot atomically through a project-deletion trigger; claimed jobs hold their slot until worker acknowledgement or deadline. Migrations are additive and were checked for repeatability. Tests cover independent connections, database reopening, cancellation, source conflicts, malformed artifacts, deletion/lease races and safe local-provider failures.

Start the app and `npm run worker` from the same checkout with the same private database/configuration after migrations. See GENERATION-WORKER.md. The actual worker CLI was tested against a disposable database: it reconciled expired jobs while inference was disabled, then exited cleanly on SIGTERM. The browser workflow accepted a real HTTP job, reloaded the page, executed a fixture provider in a separate worker process, and verified persisted source, stages and cancellation. Fixtures are not actual local model inference.

Checkpoint validation: type checks, 156 unit/integration tests, production build, repeatable migrations and all 8 browser workflows. Local model smoke remains pending because this cloud machine has no Ollama model/GPU. Saved environment startup instructions now include the worker; draft saving is not environment publication.

## Latest milestone — multi-file project workspace (30 October 2026)

Continued from GitHub main `bb61fda`. Project studios now link to an owner-scoped Arabic/English file workspace. Users browse nested source, create/edit/rename/delete files, save a complete immutable snapshot, inspect history, restore it as a new version and download either an unsaved JSON draft or a complete saved ZIP. The UI retains the captured base and draft through stale-save rejection, prevents editing before a successful initial load and confirms dirty link navigation/reloads. Drafts remain page memory; save/download before leaving, including browser history navigation.

`sourceVersionStore.replace` shares canonical transaction/ownership/base/limit checks and supports complete 200-file replacement and case-only renames. Snapshot and ZIP validation reject file/directory prefix collisions. The service and HTTP routes bound source/request sizes and expose safe error codes. ZIP output uses stored regular-file entries and CRC32, never extraction or execution. Its interoperability tests use Python3's standard ZIP reader with a timeout; Python3 is test-only, not an application runtime dependency.

An empty project can initialize the reviewed React/Vite + Node HTTP starter. Ten source files include a pinned npm lockfile, README and API test. Vite is pinned to 7.3.7. The starter was validated separately using Node22 `npm ci`, an actual HTTP API test, production build and Chromium frontend→API note-save/reload plus mobile layout. Notes are in-memory and vanish on API restart. The template currently uses JavaScript; TypeScript and persistent application storage remain future milestones. Edited/generated source is never run by Nova.

Multi-file studios disclose that static AI generation/preview cannot operate on them. Existing queued jobs still show progress/cancellation after conversion to multi-file source, and captured-base fencing prevents stale publication. Deleting all files leaves a valid empty snapshot from which the static editor can create a fresh HTML/CSS pair. Manual actions consume no AI quota. See PROJECT-WORKSPACE.md.

Validation: 200 unit/integration tests, TypeScript and production build passed. All 10 browser workflows passed across the full run and focused reruns: the initial new workflow exposed two test assumptions (a Next route announcer sharing role=alert and streamed not-found pages returning HTTP200); scoped UI assertions now verify the actual error/not-found content while JSON APIs still require 404. Browser coverage includes full CRUD/export/restore, repeated stale saves, retained JSON base, cross-owner/origin denial, failed initial loads, empty-source recovery, queue cancellation after template creation and Arabic/English mobile layout. The mobile workspace screenshot was visually reviewed.

No live model inference or full-stack application execution inside Nova is claimed. The next engineering boundary is the separately isolated install/build/test/preview runner, followed by bounded multi-file AI edits and application data provisioning. Existing local setup and web/worker startup instructions remain applicable; no environment publication was performed.
