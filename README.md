# Nova

A new Arabic/English platform for building websites through conversation. This repository currently contains the **foundation release**, not the finished AI builder.

## Available now

- Dark, reference-inspired workspace with a cyan glow, iridescent orb, icon rail, and working project suggestions.
- Persistent Arabic/English preference and RTL layouts; bundled local fonts.
- Email/password accounts and sessions using Better Auth, with database-backed rate limits.
- Owner-scoped project creation, listing, notes, and deletion with confirmation.
- A dark workspace with compact navigation, an iridescent orb, and three bilingual suggestions that preserve your draft.
- A studio that persists the brief and notes, accurately labeling generation and previews as unavailable.
- Product status and milestone documentation.

**Not implemented:** AI calls, generated source files, sandbox execution, previews, deployment, shared teams, credits, payments, email verification, and password recovery. Do not use this development release for sensitive data or public production signups.

## Local setup

Use Node.js 22. From this repository:

```sh
npm ci
npm run setup:local
npm run dev
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

The E2E suite checks signup, login, project persistence, notes after reload, cross-user rejection, signout, confirmed deletion and cancellation, locale persistence, and mobile horizontal overflow on the home, dashboard, and studio screens. Screenshots and failure traces are written under ignored `test-results/`, with an HTML report under `playwright-report/`. Test databases remain under `data/e2e/` for local debugging and may be removed after the test server stops.

GitHub Actions runs type checks, unit tests, a production build, and browser workflows for pushes to `main` and pull requests. It generates ephemeral credentials during execution; no account secrets are stored in the workflow.

## Security and deployment boundaries

- Password hashing, session cookies, and auth endpoint origin validation are handled by Better Auth.
- Next.js server actions validate authentication and ownership; never trust a client-provided owner ID.
- Notes are plain text rendered by React; do not insert them as raw HTML.
- Project descriptions must not contain API keys or infrastructure secrets.
- Local development origin is not a published website. Cloud onboarding does not expose the app in a web preview.
- No email recovery or verification provider is configured yet. Public launch must wait for these and an abuse/security review.
- No billing or AI cost is incurred by project or note actions.

See [the development plan](docs/PLAN.md) and [architecture decisions](docs/ARCHITECTURE.md).

## Design checkpoint

[Desktop screenshot](docs/screenshots/home-desktop.png) · [Mobile screenshot](docs/screenshots/home-mobile.png). Read [the continuation handoff](docs/HANDOFF.md) before starting another Codex session.
