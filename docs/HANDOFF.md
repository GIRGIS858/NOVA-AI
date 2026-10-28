# Nova — continuation handoff

## User direction

Build a substantial full-stack AI application builder, incrementally. The user approved starting from scratch in this repository and pushing tested milestones to GitHub so other Codex sessions can continue.

Latest design reference: dark rounded workspace, compact icon sidebar, cyan ambient glow, centered greeting and prompt composer, iridescent orb, and three suggestion cards. Preserve Nova branding and Arabic/English support.

## Current checkpoint

The foundation is implemented: Better Auth signup/login/logout, owner-scoped SQLite projects, saved project notes, localized landing/dashboard/studio, and product roadmap. AI generation, sandbox previews, billing, shared teams, and publication are not implemented.

Baseline verification: TypeScript, production build, 3 unit tests and 2 browser workflows passed in the previous implementation session. Browser workflows exercise signup, persisted briefs and notes, cross-user access rejection, signout/login, RTL, mobile overflow, and language persistence.

## Completed visual checkpoint (2026-10-28)

The workspace and project studio now use a scoped dark palette with cyan ambient light, rounded framing, mirrored compact navigation, a decorative iridescent orb, and a centered project composer. Public landing and authentication pages retain their existing theme.

Three bilingual suggestion cards fill an empty project name and append to the brief without replacing existing text. Keyboard selection focuses the brief; feedback is announced, the 8,000-character limit is preserved, and submission shows a pending state. Navigation has accessible names and a skip link; mobile and reduced-motion support are preserved. User-entered composer text detects its own direction.

Validation for this checkpoint: Node 22.23.4; production build and TypeScript check passed; all 3 unit tests and 3 browser workflows passed. Browser validation uses a dedicated local SQLite database and covers authentication, persistence, ownership rejection, language switching, keyboard suggestions, mobile RTL/LTR overflow, literal rendering of HTML-looking notes, and cancel/confirm deletion. The initial keyboard test raced hydration; it now waits for page network idle before manual keyboard interaction. Desktop, mobile AR/EN, and studio screenshots were reviewed. Production dependency audit returned 0 known advisories; this is not a full security certification.

## Next task

Implement the real building loop from milestone 02 in docs/PLAN.md. Decide the AI provider and isolated runner, configure credentials securely, and implement authorization, resource/cost limits, source versions, isolated builds, and preview verification before exposing generation. Do not pretend the saved brief is AI output.

Public production launch remains blocked on email verification/recovery, abuse/resource limits, deployment hardening, and the remaining documented launch review. No AI provider, deployment service, or billing integration was added in this visual checkpoint.

## Start here

1. Inspect `git status` and remote branch state. Coordinate with other sessions rather than force-pushing.
2. Activate Node 22; run `npm ci` and `npm run setup:local`.
3. Read README for running tests and browser executable configuration.
4. Use a dedicated database for E2E checks. Tests create local accounts and projects.
5. Read the plan for the next vertical slice: prompt → provider → source version → isolated build → verified preview.

No keys belong in chat, source control, browser bundles, or logs. The local development origin is not a published URL. Processes must restart after restoring the environment. There is no automatic work between sessions.
