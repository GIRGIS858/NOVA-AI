# Foundation architecture decisions

## Application

Next.js App Router, React, TypeScript, and plain CSS tokens. Server components fetch private data; server actions mutate it. Client components are limited to authentication and interactive confirmations. The application is a modular monolith, not a collection of premature microservices.

## Identity

Better Auth provides password handling, sessions, and endpoint protections. Its public migration API initializes the auth schema through an explicit CLI step. Migration writes are excluded from build workers and request handling. No custom password algorithm or homegrown JWT implementation.

## Projects

Local SQLite via better-sqlite3. `src/lib/projects.ts` accepts a database connection so authorization, validation, and transactions can be tested independently. All project operations require an authenticated owner. Unknown and unauthorized project IDs return the same unavailable page. Deletes cascade to notes.

The first workspace is the user's personal account. Shared membership and roles are deliberately deferred rather than represented by misleading controls.

## Internationalization

Locale is validated into `ar | en` and stored in an HTTP-only same-site cookie. Root language and direction update server-side. Initial screen translations are colocated bilingual copy; extract to typed message catalogs as the product grows. Do not duplicate routes for localization without a product reason.

## Scope honesty

The studio stores notes, not AI results. Its generation, preview, credits, and deployment states are explicitly unavailable. Homepage examples are CSS illustrations labeled as illustrative directions. They are not generated projects, customer data, or active templates.

## Next engineering boundary

AI orchestration and untrusted project execution must be separate concerns. A future worker must execute generated code outside the main web process, with filesystem, resource, time, and network boundaries. Secrets must not enter generated project files or model contexts. Add a real preview provider only once it can be tested end to end.

## Source snapshot service

`src/lib/versions.ts` persists append-only JSON snapshots in SQLite, using an immediate transaction to check the expected base and commit changes atomically. Restore creates a new version. Authorization always scopes to the owning project. `SOURCE_LIMITS` bounds files, UTF-8 bytes, and history length. The schema is initialized by the explicit migration command. This is internal infrastructure for the generation loop; it does not execute or publish source. See `SOURCE-VERSIONS.md`.

## Static generation integration

Generation uses the canonical source-version store with captured bases and conflict rejection. Explicit migrations add a separate run state machine and a retained attempt ledger. Failed/cancelled/deleted attempts still count toward rolling quotas; cancellation reserves concurrency until acknowledgement or lease expiry.

The first provider adapter emits only HTML/CSS. Static artifact building validates/sanitizes strings and never executes generated code. Browser previews have an opaque iframe origin, empty sandbox and restrictive CSP; generated source is never served as application-origin HTML. Full-stack execution still requires the isolated worker described above. Live generation is gated by both a server-side credential and explicit activation after the real provider smoke check. See docs/GENERATION.md.
