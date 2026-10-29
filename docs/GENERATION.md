# Static generation checkpoint

This milestone integrates authorized generation runs with the canonical source version store. It is limited to HTML and CSS. It does not run generated commands, install generated dependencies, execute JavaScript, or create public deployments.

## State and persistence

- POST `/api/projects/:id/generate` requires the authenticated owner, exact configured Origin, JSON `{requestId: UUID}`, configured server credential and explicit enable flag. It reserves once, invokes the provider and stores a source snapshot atomically on success.
- GET `/api/projects/:id/generation` returns bounded run history and all canonical version metadata (generated, manually edited, restored).
- GET `/api/projects/:id/versions/:versionId` returns authorized source JSON and a sanitized preview document. It does not serve executable HTML at the application's origin.
- POST `/api/projects/:id/generation/:runId/cancel` requires ownership and exact Origin. It marks cancellation; the running request observes it and aborts. Cancellation may still consume the provider’s free quota.

Statuses are `running`, `succeeded`, `failed`, and `cancelled`. There is no durable background queue yet: requests execute within the server request lifetime, with a 90-second timeout and a 120-second crash-recovery lease. Status reads reconcile stale leases. Nothing retries the provider automatically.

Base versions are captured before the provider call. Completion uses `sourceVersionStore.commit`; source conflicts are surfaced instead of overwriting concurrent work. Unsupported existing application snapshots and exhausted source history are rejected before a provider request. A retained accounting ledger prevents project deletion from resetting limits. Cancellation holds concurrency until the worker acknowledges it. No prompts, source bodies or provider error details are stored in that ledger.

Manual static saves and restores use separate owner/origin-checked endpoints and the same canonical store. They require no AI credential and consume no generation attempts. See `SOURCE-VERSIONS.md`.

## Preview boundary

`static-artifact.ts` accepts exactly two in-memory text files, at most 100 KiB each / 120 KiB total. Paths never become filesystem operations. HTML is allowlisted; scripts, SVG, forms, iframes and external URLs are stripped. CSP denies external resources. The preview iframe uses `sandbox=""` and `referrerPolicy="no-referrer"`. Safe fragment links are rewritten to `about:srcdoc#fragment` because ordinary fragment links in srcdoc otherwise inherit the application's base URL.

The source download retains original, untrusted source. Sanitized preview rendering is not a guarantee that exported code is safe to deploy. This is a browser sandbox for static documents, not the container/process isolation required for generated full-stack applications.

## Validation and activation

Unit tests use injected fixture providers and mocked HTTP transport. They exercise state, budgets, authorization, output validation, cancellation and source conflicts without contacting a real provider. Browser tests use a fresh isolated database and disable the AI credential. They cover real session/route authorization, fixture source retrieval, cancellation, download, mobile layout and adversarial iframe isolation. Fixtures are not presented as actual model output.

The adapter uses OpenRouter, with `thinkingmachines/inkling:free` as the default `NOVA_AI_MODEL`. Every inference requires the `:free` suffix, a current catalog entry with all declared prices zero, a zero prompt/completion price ceiling, and no provider fallback. Missing or unverified pricing stops the request. Fixed endpoints and proxy/CA settings prevent sending credentials to arbitrary destinations. Output must be a valid JSON object with exactly `html` and `css`, finish reason `stop`, and supported file sizes. The selected model does not advertise JSON-schema enforcement, so validation is local and malformed output is rejected.

No live inference has been validated here: the OpenRouter key is missing. Configure `NOVA_AI_API_KEY` securely for `openrouter.ai`, run `npm run ai:smoke` (one free-only request consuming quota), and only after success set `NOVA_AI_ENABLED=1` and restart. It prints validation metadata only. The secure requirement is saved as `NOVA_OPENROUTER_KEY` in the environment draft; a saved draft is not an applied credential.

The public catalog was checked on 29 October 2026. Inkling is listed for reasoning/coding with zero token pricing and no stated expiration at that check; availability is not guaranteed. The earlier candidate `poolside/laguna-s-2.1:free` lists expiration on 31 October 2026 and is not the default. No comparative quality benchmark or real-provider success is claimed. Configure another explicit `:free` ID if availability changes; never silently switch to a paid ID.

The next runtime milestone is an isolated application build worker with resource/network restrictions and verified preview readiness. Email verification/recovery, account abuse controls, deployment security headers, data retention and operational hardening remain prerequisites for public production use.
