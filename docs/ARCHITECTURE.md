# Foundation architecture decisions

## Application

Next.js App Router, React, TypeScript, and plain CSS tokens. Server components fetch private data; server actions mutate it. Client components handle authentication, draft composition, generation status and version previews. The application is a modular monolith, not a collection of premature microservices.

## Identity

Better Auth provides password handling, sessions, and endpoint protections. Its public migration API initializes the auth schema through an explicit CLI step. Migration writes are excluded from build workers and request handling. No custom password algorithm or homegrown JWT implementation.

## Projects

Local SQLite via better-sqlite3. `src/lib/projects.ts` accepts a database connection so authorization, validation, and transactions can be tested independently. All project operations require an authenticated owner. Unknown and unauthorized project IDs return the same unavailable page. Deletes cascade to notes.

The first workspace is the user's personal account. Shared membership and roles are deliberately deferred rather than represented by misleading controls.

## Internationalization

Locale is validated into `ar | en` and stored in an HTTP-only same-site cookie. Root language and direction update server-side. Initial screen translations are colocated bilingual copy; extract to typed message catalogs as the product grows. Do not duplicate routes for localization without a product reason.

## Scope honesty

The studio stores notes and validated source snapshots. Static generation is gated on secure provider configuration and activation; previews are sanitized HTML/CSS. Credits and deployment remain unavailable. Homepage examples are CSS illustrations labeled as illustrative directions. They are not generated projects, customer data, or active templates.

## Next engineering boundary

AI orchestration and untrusted project execution must be separate concerns. A future worker must execute generated code outside the main web process, with filesystem, resource, time, and network boundaries. Secrets must not enter generated project files or model contexts. Add a real preview provider only once it can be tested end to end.

## Source snapshot service

`src/lib/versions.ts` persists append-only JSON snapshots in SQLite, using an immediate transaction to check the expected base and commit changes atomically. Restore creates a new version. Authorization always scopes to the owning project. `SOURCE_LIMITS` bounds files, UTF-8 bytes, and history length. The schema is initialized by the explicit migration command. This is internal infrastructure for the generation loop; it does not execute or publish source. See `SOURCE-VERSIONS.md`.

## Static generation integration

Generation uses the canonical source-version store with captured bases and conflict rejection. The reservation returns an in-memory copy of the exact base files under the same transaction. The worker and provider adapter validate the complete JSON context before network use; source is never truncated to fit. Explicit migrations add a separate run state machine and a retained attempt ledger. Failed/cancelled/deleted attempts still count toward rolling quotas; cancellation reserves concurrency until acknowledgement or lease expiry.

The first provider adapter emits only HTML/CSS. Static artifact building validates/sanitizes strings and never executes generated code. Browser previews have an opaque iframe origin, empty sandbox and restrictive CSP; generated source is never served as application-origin HTML. Full-stack execution still requires the isolated worker described above. Live generation is gated by both a server-side credential and explicit activation after the real provider smoke check. See docs/GENERATION.md.

## Free inference boundary

The optional legacy remote adapter targets OpenRouter and permits explicit zero-priced `:free` models. Catalog pricing is checked before each inference, with fixed endpoints, redirects rejected, bounded response streams, inherited proxy/CA trust, a zero token-price ceiling and provider fallback disabled. `free-model.ts` owns the configurable ID; keys remain server-side. The public model catalog is not evidence of output quality or inference readiness. A secure key and real `ai:smoke` check remain external prerequisites. See `GENERATION.md`.

## Manual source editing

Owner/origin-checked HTTP routes call `staticSourceStore` for validated saves and restore-as-new snapshots. All source history reads use the canonical version store, so generated, edited and restored versions remain visible together. The editor keeps its captured base and in-memory draft during conflicts; no silent rebase or automatic retry occurs. Drafts can be downloaded before reconciliation. Manual actions consume no AI quota.

## Local-first direction — 30 October 2026

The user's current requirement is locally hosted inference without external provider keys. Ollama is the default, restricted to loopback and downloaded model metadata with no external fallback. The initial supported topology runs Nova and Ollama on the same computer. See LOCAL-AI.md for activation and PLATFORM-ROADMAP.md for the full-stack target, durable worker, isolated execution, PostgreSQL, deployment and production acceptance criteria. These planned services are not implemented by the provider adapter.

## Durable generation — 30 October 2026

Accepted generation now commits a queued job with its exact requirements/source and provider/model selection in one transaction. A separate Node worker claims under SQLite immediate locking, records phases, validates provider output and commits only against the captured source version. Claim tokens and fixed deadlines reject stale results. Queue payloads stay private and are cleared on terminal reconciliation. Jobs do not depend on browser connections; ambiguous interrupted inference is failed rather than automatically retried. See GENERATION-WORKER.md. This local orchestration worker does not execute generated code or supply the still-planned full-stack isolation boundary.

## Multi-file source workspace — 30 October 2026

The generic workspace uses the same canonical source history, ownership and limits as static generation. Full snapshot replacement is an additive source-store operation under the same immediate transaction and expected-base check; it supports replacing all 200 files and case-only renames without a partial delete/write sequence. Shared validation now rejects file/directory prefix collisions. History metadata excludes source payloads.

Owner/origin-checked routes provide save, restore and one-time starter initialization. ZIP export requires an explicit saved version and returns bounded in-memory regular-file entries; it never extracts or executes source. The client retains a captured base through conflicts. A reviewed React/Node starter and pinned lockfile are stored as source only. Generic source has no static preview or generation controls; existing queued runs retain their progress and cancellation UI. See PROJECT-WORKSPACE.md. The application execution boundary, full-stack model orchestration and database provisioning remain separate future work.
