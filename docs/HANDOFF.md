# Nova — continuation handoff

## User direction

Build a substantial full-stack AI application builder, incrementally. The user approved starting from scratch in this repository and pushing tested milestones to GitHub so other Codex sessions can continue.

Latest design reference: dark rounded workspace, compact icon sidebar, cyan ambient glow, centered greeting and prompt composer, iridescent orb, and three suggestion cards. Preserve Nova branding and Arabic/English support.

## Current checkpoint

The foundation is implemented: Better Auth signup/login/logout, owner-scoped SQLite projects, saved project notes, localized landing/dashboard/studio, and product roadmap. The later checkpoints below add source versions and a gated static generation pipeline. Billing, shared teams and public publication remain unimplemented.

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

## Latest integrated checkpoint — static generation

Merged remote checkpoint `410b606` into the static-generation work; the canonical `sourceVersionStore` remains the single source of truth. Added explicit generation migrations, durable owner-scoped runs, idempotency, cancellation acknowledgements, crash recovery, rolling request limits, base-version capture and atomic source conflict rejection. Existing non-static source projects are rejected before a provider request.

Added an OpenAI adapter (`gpt-4.1-mini`, fixed HTTPS endpoint) with proxy support, structured output, 60-second timeout and 4,096 output-token limit. Static previews sanitize HTML/CSS and use an empty-sandbox iframe with CSP and no network access. Browser-tested internal anchors use `about:srcdoc#...` to avoid navigating the frame to the parent application. Source view/download, version history and cancellation controls support Arabic and English. No generated code runs on the server.

Validation: 70 unit tests and all 6 browser workflows passed; production build and TypeScript passed; database migration succeeded twice. Production dependency audit reported 0 known advisories. Browser tests use a unique database and fixture source artifacts, force the AI credential empty, and cover authorization, source/download, cancellation, mobile RTL/LTR and hostile preview isolation. Fixture-provider tests are not live AI validation.

**External prerequisite:** no OpenAI API credential is configured or validated. `NOVA_AI_API_KEY` requirement is saved in the cloud environment draft for `api.openai.com`. Enter its value securely in environment settings. Run `npm run ai:smoke` (one billable real request), then set `NOVA_AI_ENABLED=1` only after success. Both the credential and flag are required; the default is disabled. Never put a key in chat or source control. See `docs/GENERATION.md` and README for limits and the static-only boundary.

## Next work

1. Validate the real provider with the secure credential, then enable and test actual generation end to end.
2. Implement a separately isolated worker for generated JavaScript/full-stack builds; current preview only renders sanitized static HTML/CSS in the browser.
3. Add production hardening, email verification/recovery, operational/resource controls and provider spending budgets before public launch. Billing, teams and public deployment remain planned.

The user explicitly requests pushing each completed checkpoint to GitHub immediately. Fetch before pushing and preserve concurrent work. Do not force-push. The safety checkpoint is on `codex/static-generation`; integrate verified results into main without dropping other sessions' commits.

## Start here

1. Inspect `git status` and remote branch state. Coordinate with other sessions rather than force-pushing.
2. Activate Node 22; run `npm ci` and `npm run setup:local`.
3. Read README for running tests and browser executable configuration.
4. Use a dedicated database for E2E checks. Tests create local accounts and projects.
5. Read the plan for the next vertical slice: prompt → provider → source version → isolated build → verified preview.

No keys belong in chat, source control, browser bundles, or logs. The local development origin is not a published URL. Processes must restart after restoring the environment. There is no automatic work between sessions.
