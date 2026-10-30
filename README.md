# Nova

A new Arabic/English platform for building websites through conversation. This repository currently contains the **static generation development release**, not the finished AI builder.

## Available now

- Dark, reference-inspired workspace with a cyan glow, iridescent orb, icon rail, and working project suggestions.
- Persistent Arabic/English preference and RTL layouts; bundled local fonts.
- Email/password accounts and sessions using Better Auth, with database-backed rate limits.
- Owner-scoped project creation, listing, notes, and deletion with confirmation.
- A studio that persists briefs/notes and displays saved HTML/CSS versions, source files, JSON downloads, and sandboxed static previews.
- Manual HTML/CSS editor with immutable saves, version restoration, and preserved on-page drafts when another session changes the source. No AI key is needed for manual editing.
- Product status and milestone documentation.
- Immutable source snapshots with ownership, concurrency checks and resource limits, now integrated with generation runs.
- Durable generation queue with a separate worker, saved stages, cancellation and bounded crash recovery.
- Local Ollama inference without provider keys, with bounded structured output, cancellation and immutable source snapshots. The legacy free-only OpenRouter adapter is explicit opt-in only. Live generation stays disabled until validated.

**Not implemented:** JavaScript/full-stack execution, isolated application build workers, public deployment, shared teams, credits, payments, email verification, and password recovery. Real local inference has not been validated here because this cloud machine has no Ollama model or GPU. Do not use this development release for sensitive data or public production signups.

## Local setup

Use Node.js 22. From this repository:

```sh
npm ci
npm run setup:local
npm run dev
# In another terminal, from the same checkout:
npm run worker
```

`setup:local` generates a private session secret on first use and runs schema migrations. It preserves an existing `.env.local`. Do not commit or share that file. Configure `BETTER_AUTH_URL` to the exact application origin; its local default is `http://localhost:3000`.

```sh
npm run db:migrate
npm run dev
```

For a production-mode local check:

```sh
npm run build
npm start
# In another terminal:
npm run worker
```

The managed environment has Node 22 at `/workspace/toolchains/node22/node_modules/node/bin`; prepend this directory to PATH when needed. Each cloud task is isolated; use this checkout and do not create additional worktrees unless requested.

## Windows PowerShell

Install Node.js 22, open PowerShell in this checkout, then:

```powershell
npm ci
npm run setup:local
npm run dev
```

Setup writes the secret directly to the local file without printing it. On your own machine, open the local application on port 3000.

## Static AI generation (disabled by default)

The default is **Ollama on the same machine as Nova**, with no provider API key. Follow [local AI setup](docs/LOCAL-AI.md). Configure `NOVA_OLLAMA_MODEL`, keep `NOVA_AI_ENABLED=0`, and run `npm run ai:smoke` against your downloaded model. Enable generation only after it succeeds. The adapter uses loopback only, rejects cloud-backed model metadata and never falls back to an external service. It requests a 16K context with up to 4,096 output tokens and a conservative 10,000-byte messages limit. Model weights and appropriate GPU hardware are required; free model weights do not make hardware or electricity free.

The user's initial machine has 16 GB RAM and an RTX 5070. `qwen2.5-coder:7b` is a starting candidate to benchmark, not a measured quality winner. The cloud environment has tested fixture responses only, not actual model inference. See the [full-stack delivery roadmap](docs/PLATFORM-ROADMAP.md).

The legacy adapter requires explicit `NOVA_AI_PROVIDER=openrouter`, a secure `NOVA_AI_API_KEY` targeting `openrouter.ai`, and an explicit free `NOVA_AI_MODEL`. It verifies live zero pricing before every request, rejects unverifiable pricing, enforces a zero token-price ceiling and disables fallback. It is not required for local inference. Existing installations that used OpenRouter must now select it explicitly.

Generation sends the saved name, brief and up to eight latest notes (bounded to 16,000 characters), together with the complete captured HTML/CSS source snapshot, to the explicitly selected runtime. Oldest note content is omitted first without splitting Unicode pairs. Source files are never truncated: the complete JSON context is limited to 256 KiB of UTF-8 and oversized contexts stop before any provider call. A new project uses create mode; existing source uses edit mode with instructions to preserve unrequested content and design. Unsaved editor text is not included. Source is captured in the same transaction as the run’s base version, so another session cannot silently replace the source used by that run. OpenRouter output is capped at 12,000 tokens (local Ollama: 4,096) and the operation at 90 seconds. JSON is requested in the prompt and validated locally; provider-enforced structured output is not assumed. Invalid or truncated output saves no version.

Each attempt consumes one of 3 per account / 20 environment-wide in a rolling 24-hour window, including failures and cancellations. There is at most one active request per account and three globally. Provider free quotas may be lower. These controls do not make hosting, storage or future deployment infrastructure free.

A run captures its base source version before calling the model. Newer source edits win: stale output fails with a conflict and is never silently retried. Cancelled/deleted runs cannot publish a version; their concurrency reservation remains held until the worker acknowledges completion or its 120-second lease expires. Quota records survive project deletion. Schema initialization is explicit via `npm run db:migrate`.

Only `index.html` and `styles.css` are supported by this generator. Preview construction sanitizes HTML, removes active content, escapes style-tag boundaries, and adds a restrictive CSP. The iframe has an empty sandbox and an opaque origin: scripts, forms, external resources and parent access are disabled. Source files remain untrusted; the JSON download contains original source, not a vetted deployment bundle. A preview is local browser rendering, not a published site or an isolated application build worker.

Use **Add files manually** in a project to create HTML/CSS without an AI key. Saving appends a new version and updates its isolated preview. Select an earlier version to restore it as a new snapshot. Concurrent changes produce a conflict and preserve the on-page draft; download or copy it before opening the latest source. Save before navigating away.

See [generation boundaries and validation](docs/GENERATION.md) and [source editor behavior](docs/SOURCE-VERSIONS.md).

## Background generation

Run `npm run worker` alongside the web server when generation is enabled. Requests return a queued job immediately; work continues after page closure. The studio shows persisted waiting/generation/validation stages. Queued work survives a restart for up to ten minutes; expired or interrupted inference is marked failed and is never automatically repeated. See [worker startup and recovery](docs/GENERATION-WORKER.md). This worker orchestrates the model and validates HTML/CSS; full-stack source execution still requires a separate isolation boundary.

## Storage and migrations

SQLite is the local foundation database (`data/nova.sqlite`, override with `NOVA_DATABASE_PATH`). Its files contain private account and project data; protect and back them up appropriately. Projects use parameterized statements, explicit ownership filters, transactions for notes, and cascading note deletion.

Run `npm run db:migrate` explicitly before starting a fresh installation. Better Auth owns its authentication schema; its migration planner refuses unsafe changes. Do not run migrations concurrently. Future project schema changes need explicit versioned migrations; the current initial project schema is created during database initialization.

SQLite is appropriate for this single-instance foundation. Multi-instance hosting requires a reviewed PostgreSQL migration, shared rate limits, backup/restore validation, and operational hardening. Do not merely point this SQLite adapter at PostgreSQL.

## Validation

```sh
npm run typecheck
npm test
npm run build
# Build first; Playwright starts its own test server on port 3100:
npm run test:e2e
```

Browser tests start a separate production-mode server on port 3100 with a random session secret and a unique database under ignored `data/e2e/`. They never reuse your running development server or account database. Build first. Set `NOVA_E2E_PORT` to another available local port when needed.

Playwright uses `/usr/bin/chromium` when available in this local cloud image, otherwise its bundled browser. Run `npx playwright install chromium` on other machines, or set `CHROMIUM_PATH` to an explicit compatible executable. CI installs Chromium and system dependencies automatically.

The E2E suite includes a separate-process queued-generation fixture and uses persisted fixture artifacts for generation UI/security checks; it never calls the live provider. It also checks signup, login, project persistence, notes after reload, cross-user rejection, signout, confirmed deletion and cancellation, locale persistence, and mobile horizontal overflow on the home, dashboard, and studio screens. Screenshots and failure traces are written under ignored `test-results/`, with an HTML report under `playwright-report/`. Test databases remain under `data/e2e/` for local debugging and may be removed after the test server stops.

GitHub Actions runs type checks, unit tests, a production build, and browser workflows for pushes to `main` and pull requests. It generates ephemeral credentials during execution; no account secrets are stored in the workflow.

## Security and deployment boundaries

- Password hashing, session cookies, and auth endpoint origin validation are handled by Better Auth.
- Next.js server actions validate authentication and ownership; never trust a client-provided owner ID.
- Notes are plain text rendered by React; do not insert them as raw HTML.
- Project descriptions must not contain API keys or infrastructure secrets.
- Local development origin is not a published website. Cloud onboarding does not expose the app in a web preview.
- No email recovery or verification provider is configured yet. Public launch must wait for these and an abuse/security review.
- Saving a project or note makes no AI request. Explicit local generation and smoke checks use your hardware; the optional remote adapter consumes provider free quota.

See [the development plan](docs/PLAN.md) and [architecture decisions](docs/ARCHITECTURE.md).

## Design checkpoint

[Desktop screenshot](docs/screenshots/home-desktop.png) · [Mobile screenshot](docs/screenshots/home-mobile.png). Read [the continuation handoff](docs/HANDOFF.md) before starting another Codex session.
