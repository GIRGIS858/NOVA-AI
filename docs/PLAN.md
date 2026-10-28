# Delivery plan

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

Completed prerequisite: owner-scoped immutable source versions, structured writes/deletes, restoration, transactional stale-base protection, portable path validation, and file/byte/history limits. The service is internal and does not yet expose generation or execution. See `SOURCE-VERSIONS.md`. Latest checks: 27 unit tests, 4 browser workflows, types, production build, and repeatable migrations all passed.

Required decisions: AI provider and reachable endpoint, runner infrastructure, secrets configuration, preview access mechanism. Introduce provider and runner interfaces, bounded execution, cancellation, scoped file paths, and failure recovery. Keep tests with fake providers separate from actual-provider validation.

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
- [x] Bounded OpenAI adapter, proxy/TLS support and an explicit live smoke command.
- [x] Sanitized static HTML/CSS preview with empty iframe sandbox, CSP and adversarial browser validation.
- [x] Source/version UI, JSON download, owner-scoped endpoints and Arabic/English mobile tests.
- [x] 70 unit tests, 6 browser workflows, production build, type check and repeatable migrations.
- [ ] Supply a secure provider credential and complete real OpenAI validation before activation.
- [ ] Isolated full-stack build worker, actual deployment and production readiness.

Generation remains disabled by default; simulated provider and fixture preview results are not evidence of live AI behavior.
