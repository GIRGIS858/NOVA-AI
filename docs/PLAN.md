# Delivery plan

Current direction: local AI on the user’s 16 GB RAM / RTX 5070 machine, without external provider keys. The full-stack sequence and acceptance criteria are in [PLATFORM-ROADMAP.md](PLATFORM-ROADMAP.md); older provider-key prerequisites below describe the previous remote-only milestone.

## 01 — Foundation (current)

- [x] Original responsive marketing page.
- [x] Local fonts, Arabic RTL, English, persistent locale.
- [x] Better Auth accounts and sessions.
- [x] Explicit, repeatable auth schema migration.
- [x] Owner-scoped project and note persistence.
- [x] Studio foundation with truthful feature states.
- [x] Ownership and validation unit tests.
- [x] Production build, browser checks, and visual review.

Verified in this environment: TypeScript check, production build, 3 ownership/validation unit tests, and 2 end-to-end browser workflows. The browser checks exercise real signup/login, persisted projects and notes, cross-user rejection, signout, mobile layout, and persistent language switching. Local schema setup was run twice successfully. Desktop, mobile, and studio screenshots were visually inspected.

## 01b — Dark workspace and continuity (complete)

- [x] Dark/cyan reference-inspired home, orb, icon rail, prompt suggestions.
- [x] Consistent dashboard/studio/login palette and mobile layouts.
- [x] Brief persistence through sign-in without private text in URLs.
- [x] Repeated redirect query validation.
- [x] Isolated portable browser runner and GitHub Actions workflow.
- [x] Four complete browser workflows passed after merging the concurrent workspace redesign.
- [x] Screenshot evidence and continuation instructions.

## 02 — A real building loop

Next vertical slice: one user prompt → an authorized run → structured file operations → a stored source version → isolated build → verified preview.

Completed prerequisite: owner-scoped immutable source versions, structured writes/deletes, restoration, transactional stale-base protection, portable path validation, and file/byte/history limits. The initial service was internal; the later milestones below add generation and manual editing through it. See `SOURCE-VERSIONS.md`. Latest checks: 27 unit tests, 4 browser workflows, types, production build, and repeatable migrations all passed.

Remaining prerequisites: secure provider key/live validation, full-stack runner infrastructure and its preview access mechanism. Introduce provider and runner interfaces, bounded execution, cancellation, scoped file paths, and failure recovery. Keep tests with fake providers separate from actual-provider validation.

## 03 — Reliability and source versions

Diffs, recovery, concurrent edit protection, interrupted run reconciliation, storage limits, preview cleanup, and resource policies.

## 04 — Credits and billing

Versioned pricing rules, integer ledger entries, atomic reservations and settlements, duplicate-event handling, test-mode payment provider, and cost-based plan review. Do not enable live checkout until specifically authorized and economically reviewed.

## 05 — Publishing and collaboration

Workspace membership roles, verified deployment lifecycle, public URLs, domains, rollback, and audit logs.

## Launch requirements

PostgreSQL migration for multi-instance hosting, production email verification/recovery, backup and restore drill, operational metrics, retention and privacy policies, security review, load tests, and provider/infrastructure cost measurements.

Work proceeds in explicit sessions. Record completed work, evidence, and next steps here; do not depend on conversational memory or promise unattended work between sessions.

## Integrated static generation checkpoint

- [x] Canonical source-version integration with captured base and conflict rejection.
- [x] Durable attempts, cancellation acknowledgement, stale-run recovery, idempotency and rolling quotas.
- [x] Bounded free-only OpenRouter adapter, proxy/TLS support and an explicit live smoke command.
- [x] Sanitized static HTML/CSS preview with empty iframe sandbox, CSP and adversarial browser validation.
- [x] Source/version UI, JSON download, owner-scoped endpoints and Arabic/English mobile tests.
- [x] 72 unit tests, 6 browser workflows, production build, type check and repeatable migrations.
- [ ] Supply a secure provider credential and complete real OpenRouter validation before activation.
- [ ] Isolated full-stack build worker, actual deployment and production readiness.

Generation remains disabled by default; simulated provider and fixture preview results are not evidence of live AI behavior.

## Continuation after concurrent integration

- [x] Preserve main through `2b1486a`, including validated manual-source save/restore service and tests.
- [x] Replace paid inference with a configurable, free-only OpenRouter adapter and catalog/price guards.
- [x] Keep full hostile-preview, ownership, cancellation and source-history coverage.
- [x] Connect manual-source save/restore to owner-scoped HTTP routes and editor UI, including immutable history, conflict draft preservation and bilingual mobile checks.
- [x] Include complete captured source in AI edit context, enforce encoded UTF-8 limits, and preserve newer manual edits on conflicts.
- [ ] Benchmark free model quality on representative Arabic/English sites once the secure key is available.

Latest integrated verification: 101 unit tests, 7 browser workflows, TypeScript and production build passed after adding the manual source editor. Static generation still awaits a secure OpenRouter key and real inference validation.

Source-aware context checkpoint: 113 unit tests, all 7 browser workflows, TypeScript and production build passed. Live inference remains blocked on the secure key.

## Source comparison — 30 October 2026

- [x] Arabic/English comparison of selected saved versions with baseline selection, added/removed lines and unchanged-file indicators.
- [x] Bounded comparison work and disclosed display limits for large files; original source/download stays complete.
- [x] 125 unit tests, production build, type checks and all 7 browser workflows.
- [ ] Focused changed-line navigation and downloadable comparisons for larger histories.

## Local inference foundation — 30 October 2026

- [x] Ollama provider selection by default, local model checks, no API key or remote fallback.
- [x] Bounded schema output, whole-source/context rejection and shared artifact validation.
- [x] Provider-aware Arabic/English disclosure and local activation instructions.
- [ ] Real model smoke and bilingual benchmark on the user's computer.
- [ ] Durable orchestration worker and persisted progress events before full-stack execution.
