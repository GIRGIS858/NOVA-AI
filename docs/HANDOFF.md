# Nova — continuation handoff

## User direction

Build a substantial full-stack AI website builder from scratch in this repository. Preserve the premium dark/cyan reference-inspired interface, orb, compact navigation, Arabic/English and RTL. The user explicitly requests **free AI only** and frequent tested GitHub checkpoints. A “strongest model” claim requires real comparative evidence; no such benchmark has run.

Fetch before pushing: more than one Codex session may change `main`. Preserve their commits; never force-push. Keep this file current so another session can resume without chat history.

## Current integrated checkpoint — 29 October 2026

Base includes `2b1486a` and all preceding concurrent milestones. Accounts, owner-scoped projects/notes, private session drafts, dark workspace, immutable source snapshots, static-generation runs, preview/source/history/download UI and manual-source save/restore **service** are retained.

Replaced the paid OpenAI adapter with **OpenRouter free-only inference**. `NOVA_AI_MODEL` defaults to `thinkingmachines/inkling:free`. The public catalog was checked today: zero prompt/completion prices and no listed expiration. Earlier candidate Laguna S 2.1 lists expiration on 31 October and is not the default. This is availability evidence, not live inference or a comparative quality benchmark.

Each request requires an explicit `:free` ID, a live catalog entry with all declared prices zero, zero token-price ceiling and disabled provider fallback. Missing/expired/unverifiable pricing blocks inference. Fixed HTTPS endpoints, normal TLS/proxy trust, bounded response streams and safe error codes protect secrets. JSON output is requested and validated locally; schema enforcement by the model is not assumed.

Current limits: 90-second operation, 12,000 output tokens, 16,000 prompt characters, 3 attempts/account and 20/environment per rolling 24 hours, 1 active/account and 3 globally. Attempts persist across project deletion; cancellation holds concurrency until acknowledged or a 120-second lease expires. Runs execute inside request lifetimes, not a durable background queue. No automatic retries.

Generation regenerates exactly `index.html` + `styles.css` from saved brief and latest notes. It does **not yet include current source in model context**. Source commits capture the base and reject concurrent edits. The preview sanitizer and empty-sandbox iframe disable scripts, forms, external resources and parent access. Source downloads contain original untrusted code. This is a static HTML/CSS preview, not a full-stack application runner or public deployment.

## Verified evidence

- `npm run typecheck`: passed.
- `npm test`: 101 tests passed, including free-price guards and all retained source/store tests.
- `npm run build`: passed.
- `npm run test:e2e`: all 6 workflows passed against isolated production server/database. Includes ownership, cancellation, source download, mobile RTL/LTR and hostile iframe isolation.
- `npm run setup:local` and repeated `db:migrate`: verified in this environment.
- Provider/HTTP tests use fixtures. **No live inference has run; no AI credential is configured.**

The static browser test invokes the actual sanitizer through Node's TS loader in a subprocess because Playwright's custom loader cannot link sanitize-html's CJS-to-ESM dependency. It retains all hostile-content assertions.

## Secure activation prerequisite

Add an OpenRouter key securely in environment settings as `NOVA_AI_API_KEY`, targeting `openrouter.ai`. The saved requirement is named `NOVA_OPENROUTER_KEY`; a saved draft does not establish runtime readiness. Never request or expose keys in chat/source/logs.

Run `npm run ai:smoke` (one free-only request consuming quota), then set `NOVA_AI_ENABLED=1` and restart only after it passes. `NOVA_AI_MODEL` may select another explicit free ID; availability and free quotas can change. Hosted infrastructure is not guaranteed free. Read `docs/GENERATION.md` and README.

## Next work

1. Connect `staticSourceStore` save/restore to owner-checked HTTP routes and editor controls. The backend service and tests landed in `2b1486a`; those operations are not yet exposed in the UI. Include manual versions in history without dropping generation versions, retain stale-base conflicts and preview validation.
2. Include the captured source snapshot in AI edit context, with explicit byte limits and preservation of existing work.
3. Once the key is provided, validate actual inference and compare free models on Arabic/English site quality. Keep it disabled until validated.
4. Add a separately isolated worker for generated JavaScript/full-stack builds, resource/network policies and verified readiness. Never execute generated code inside the Next.js process.
5. Billing, shared teams, publication, email verification/recovery, backups, operational controls and production hardening remain planned.

## Starting another session

Use the existing checkout; no worktree unless requested. Activate Node 22 at `/workspace/toolchains/node22/node_modules/node/bin`, then `npm ci` and `npm run setup:local`. Read `AGENTS.md`, plan and architecture. Browser tests start their own server on port 3100; build first. Never point them at production.

Local `data/nova.sqlite` had an empty development-only generation table from the preserved `codex/free-ai-checkpoint` branch. It was backed up under ignored `data/` and renamed to `generation_runs_checkpoint_archive` before applying the canonical migration. Account and project data were retained. Do not merge that branch's alternate schema/UI wholesale into main; relevant free-only safeguards are integrated here.

The original free-generation work is preserved on GitHub at `codex/free-ai-checkpoint` (`1434a70`). Local secrets, databases, generated output and browser profiles remain ignored. Processes must restart after environment restoration. Localhost is not a published URL; work does not continue automatically between sessions.
