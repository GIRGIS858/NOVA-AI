# Nova — continuation handoff

## User direction

Build a substantial full-stack AI application builder, incrementally. The user approved starting from scratch in this repository and pushing tested milestones to GitHub so other Codex sessions can continue.

Latest design reference: dark rounded workspace, compact icon sidebar, cyan ambient glow, centered greeting and prompt composer, iridescent orb, and three suggestion cards. Preserve Nova branding and Arabic/English support.

## Current checkpoint

The foundation is implemented: Better Auth signup/login/logout, owner-scoped SQLite projects, saved project notes, localized landing/dashboard/studio, and product roadmap. AI generation, sandbox previews, billing, shared teams, and publication are not implemented.

Baseline verification: TypeScript, production build, 3 unit tests and 2 browser workflows passed in the previous implementation session. Browser workflows exercise signup, persisted briefs and notes, cross-user access rejection, signout/login, RTL, mobile overflow, and language persistence.

## Latest completed milestone — dark workspace

Implemented the reference-inspired dark/cyan shell, responsive icon rail, CSS iridescent orb, central composer, working prompt suggestions, and consistent dashboard/studio/login palette. Arabic RTL mirrors the desktop rail; mobile uses compact top navigation.

Private briefs now persist in tab-scoped session storage through sign-in, instead of query strings. Successful creation clears the matching draft. Repeated `next` query parameters no longer crash login.

Validation: type check, 3 unit tests, production build, and all 3 browser workflows passed. The browser suite now runs against its own port 3100 server and fresh SQLite database. It additionally checks mobile studio/dashboard layouts, delete cancel/confirm, and repeated redirect parameters. Screenshots are in `docs/screenshots/`. GitHub Actions is configured; remote CI execution has not yet been observed.

## Concurrent session integration

Merged the separate session's `595d088` workspace redesign into this branch. Its accessible, append-only suggestion composer, pending save state, scoped workspace theme, navigation, and keyboard/mobile/XSS checks are preserved. The public dark home, session draft privacy fixes, dedicated browser runner, and CI configuration are also retained. Styles are scoped to prevent cross-route leaks. The combined tree passed TypeScript, all 3 unit tests, the production build, and all 4 browser workflows. Always fetch before pushing: more than one session may be active.

## Latest backend checkpoint — source versions

Implemented the internal `sourceVersionStore` in `src/lib/versions.ts`, exported as `sourceVersions` from `db.ts`. Explicit schema setup runs in `npm run db:migrate`. It supports immutable snapshots, write/delete changes, restore-as-new-version, ownership checks, optimistic concurrency, transactional rollback, portable path validation, and bounded UTF-8/file/history sizes. Metadata listing does not load all file bodies.

Latest validation: 27 unit tests, 4 browser workflows, production build, and TypeScript passed. Source schema setup succeeded twice. Browser tests use fresh isolated databases and preserve both sessions' coverage. See `docs/SOURCE-VERSIONS.md` for the API and security boundaries.

There are no public source mutation endpoints or source editor controls yet. This module does not invoke an AI provider, write files outside SQLite, execute code, create previews, or publish sites.

## Next task — authorized generation runs

1. Add durable, owner-scoped generation runs and an explicit state machine (queued/running/checking/ready/failed/cancelled), idempotency, cancellation, and stale-run reconciliation.
2. Add a provider adapter accepting a configured endpoint/model with server-side secrets. No provider credentials have been configured or validated. Inspect environment bindings before requesting setup; never put keys in chat.
3. Capture the source base version before a model request. Validate structured output through `sourceVersions.commit`; reject conflicts rather than replacing newer edits.
4. Build a runner abstraction with real process/container isolation, resource/network boundaries, and verified readiness. Do not execute generated code in the Next.js server.
5. Only expose generation and previews when actual-provider and actual-runner checks pass. Fake-provider tests are useful but must remain clearly distinguished.

Billing, shared teams, public deployment, email recovery/verification, and production hardening remain planned. No fixed commercial pricing has been enabled.

## Start here

1. Inspect `git status` and remote branch state. Coordinate with other sessions rather than force-pushing.
2. Activate Node 22; run `npm ci` and `npm run setup:local`.
3. Read README for running tests and browser executable configuration.
4. Use a dedicated database for E2E checks. Tests create local accounts and projects.
5. Read the plan for the next vertical slice: prompt → provider → source version → isolated build → verified preview.

No keys belong in chat, source control, browser bundles, or logs. The local development origin is not a published URL. Processes must restart after restoring the environment. There is no automatic work between sessions.
