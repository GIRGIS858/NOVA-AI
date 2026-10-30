# Nova — continuation handoff

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

1. Source comparison is implemented (see the milestone below). Next, add a focused changed-lines view and a downloadable comparison for larger source histories.
2. Once the key is provided, validate actual inference and compare free models on Arabic/English site quality. Keep it disabled until validated.
3. Add a separately isolated worker for generated JavaScript/full-stack builds, resource/network policies and verified readiness. Never execute generated code inside the Next.js process.
4. Billing, shared teams, publication, email verification/recovery, backups, operational controls and production hardening remain planned.

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
