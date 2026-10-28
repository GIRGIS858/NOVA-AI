# Nova — continuation handoff

## User direction

Build a substantial full-stack AI application builder, incrementally. The user approved starting from scratch in this repository and pushing tested milestones to GitHub so other Codex sessions can continue.

Latest design reference: dark rounded workspace, compact icon sidebar, cyan ambient glow, centered greeting and prompt composer, iridescent orb, and three suggestion cards. Preserve Nova branding and Arabic/English support.

## Current checkpoint

The foundation is implemented: Better Auth signup/login/logout, owner-scoped SQLite projects, saved project notes, localized landing/dashboard/studio, and product roadmap. AI generation, sandbox previews, billing, shared teams, and publication are not implemented.

Baseline verification: TypeScript, production build, 3 unit tests and 2 browser workflows passed in the previous implementation session. Browser workflows exercise signup, persisted briefs and notes, cross-user access rejection, signout/login, RTL, mobile overflow, and language persistence.

## Current task

Apply the user's dark visual reference, validate it, then push a separate checkpoint. Update this document with completed work and exact validation results before pushing.

## Start here

1. Inspect `git status` and remote branch state. Coordinate with other sessions rather than force-pushing.
2. Activate Node 22; run `npm ci` and `npm run setup:local`.
3. Read README for running tests and browser executable configuration.
4. Use a dedicated database for E2E checks. Tests create local accounts and projects.
5. Read the plan for the next vertical slice: prompt → provider → source version → isolated build → verified preview.

No keys belong in chat, source control, browser bundles, or logs. The local development origin is not a published URL. Processes must restart after restoring the environment. There is no automatic work between sessions.
