# Static generation checkpoint

This milestone integrates authorized generation runs with the canonical source version store. It is limited to HTML and CSS. It does not run generated commands, install generated dependencies, execute JavaScript, or create public deployments.

## State and persistence

- POST `/api/projects/:id/generate` requires the authenticated owner, exact configured Origin, JSON `{requestId: UUID}`, configured server credential and explicit enable flag. It reserves once, invokes the provider and stores a source snapshot atomically on success.
- GET `/api/projects/:id/generation` returns bounded run history and generation-produced version metadata.
- GET `/api/projects/:id/versions/:versionId` returns authorized source JSON and a sanitized preview document. It does not serve executable HTML at the application's origin.
- POST `/api/projects/:id/generation/:runId/cancel` requires ownership and exact Origin. It marks cancellation; the running request observes it and aborts. Cancellation cannot undo already incurred provider costs.

Statuses are `running`, `succeeded`, `failed`, and `cancelled`. There is no durable background queue yet: requests execute within the server request lifetime, with a 60-second timeout and a 120-second crash-recovery lease. Status reads reconcile stale leases. Nothing retries the provider automatically.

Base versions are captured before the provider call. Completion uses `sourceVersionStore.commit`; source conflicts are surfaced instead of overwriting concurrent work. Unsupported existing application snapshots and exhausted source history are rejected before a provider request. A retained accounting ledger prevents project deletion from resetting limits. Cancellation holds concurrency until the worker acknowledges it. No prompts, source bodies or provider error details are stored in that ledger.

## Preview boundary

`static-artifact.ts` accepts exactly two in-memory text files, at most 100 KiB each / 120 KiB total. Paths never become filesystem operations. HTML is allowlisted; scripts, SVG, forms, iframes and external URLs are stripped. CSP denies external resources. The preview iframe uses `sandbox=""` and `referrerPolicy="no-referrer"`. Safe fragment links are rewritten to `about:srcdoc#fragment` because ordinary fragment links in srcdoc otherwise inherit the application's base URL.

The source download retains original, untrusted source. Sanitized preview rendering is not a guarantee that exported code is safe to deploy. This is a browser sandbox for static documents, not the container/process isolation required for generated full-stack applications.

## Validation and activation

Unit tests use injected fixture providers and mocked HTTP transport. They exercise state, budgets, authorization, output validation, cancellation and source conflicts without making billable requests. Browser tests use a fresh isolated database and disable the AI credential. They cover real session/route authorization, fixture source retrieval, cancellation, download, mobile layout and adversarial iframe isolation. Fixtures are not presented as actual model output.

No live OpenAI request has been validated in this environment: its credential is missing. Configure `NOVA_AI_API_KEY` securely for `api.openai.com`, run `npm run ai:smoke`, and only after success set `NOVA_AI_ENABLED=1` and restart. The smoke request is billable and reports validation metadata only; it does not log credentials or generated code. Keep generation disabled until that check passes.

The next runtime milestone is an isolated application build worker with resource/network restrictions and verified preview readiness. Email verification/recovery, account abuse controls, deployment security headers, data retention and operational hardening remain prerequisites for public production use.
