# Nova engineering handoff

Read `docs/HANDOFF.md`, `docs/PLAN.md`, and `docs/ARCHITECTURE.md` before starting.

The user authorized building Nova from scratch and pushing tested, incremental checkpoints to `GIRGIS858/NOVA-AI`. Keep delivery notes current so another Codex session can continue. Inspect remote changes before pushing; never force-push or overwrite another session's work.

Use the existing checkout. Every cloud task is isolated; do not create worktrees unless the user requests them. Preserve unrelated changes.

Use Node 22, `npm ci`, and `npm run setup:local`. Cloud Node path: `/workspace/toolchains/node22/node_modules/node/bin`.

Validate affected behavior with type checks, unit tests, production build, and relevant browser workflows. Report checks actually run. Keep credentials, `.env.local`, local databases, browser profiles, and generated build output out of Git.

Product direction: premium dark workspace inspired by the user's reference, cyan ambient light, compact icon navigation, central composer, and an iridescent orb. Keep Nova branding, Arabic/English support, RTL, accessible names, and honest feature states. Do not introduce pretend billing, model outputs, or deployment status.

Do not execute generated code in the platform process. Implement provider, budget, isolation, and version boundaries before enabling AI generation. Keep the source of truth for next tasks in the handoff document.
