# Durable generation worker

Generation is accepted by the web server and performed in a separate Node process. This is an orchestration worker for trusted provider/validation code. It does **not** execute generated source and is not the isolated application build runner planned for full-stack projects.

## Start and stop

Use Node 22 and the same checkout, private environment configuration and local SQLite database for the app and worker. Run migrations once before starting either process:

```sh
npm run db:migrate
npm run dev
```

In another terminal in the same checkout:

```sh
npm run worker
```

For production-mode local validation, build and use `npm start` instead of `npm run dev`. `SIGINT`/`SIGTERM` stops claiming work and aborts the worker's active inference. It records the interrupted attempt and closes the database. Restart the worker with the same command. Live inference must already have passed `npm run ai:smoke`; the worker stays idle while generation is disabled. It never enables generation or downloads a model. With local inference, Ollama, Nova and this worker must share the user's machine.

The worker keeps running without an open browser. A published environment snapshot retains files/database but not this process; start both processes in each new instance. SQLite/WAL and a five-second busy timeout support these local processes. Multiple execution hosts and network-mounted SQLite are unsupported; PostgreSQL/shared-worker coordination is a separate milestone.

## API and persistence

- `POST /api/projects/:id/generate` validates owner/origin/configuration and `{requestId}`, then returns **202** with a queued run. Repeating the same idempotency key returns **200** and the original run; it never creates another attempt.
- Reservation, captured base/source, saved requirements, provider/model identity and the queued job commit in one SQLite transaction. No API key, endpoint or provider error body is saved in a job.
- Each worker claims one queued job in an immediate transaction. A random claim token fences updates. An independently connected worker cannot claim the same job.
- The worker refuses a provider/model configuration mismatch rather than sending captured private data to a different runtime.
- The history endpoint returns safe phase events: `queued`, `generating`, `validating`, then `succeeded`, `failed` or `cancelled`. The bilingual UI polls this endpoint and selects the newly saved version when active work settles. No progress percentages or fake build/deployment stages are shown.
- Private payloads are erased after terminal settlement; deleting a project cascades its jobs/events. The existing attempt ledger survives deletion to preserve quota accounting. SQLite backups/WAL may retain historical bytes; payload cleanup is not a secure-erasure guarantee.

## Recovery and cancellation

A queued job can wait up to ten minutes, including a web/worker restart. Claiming starts a fresh 120-second lease with a 90-second provider deadline. There is no heartbeat-based extension yet. Queued jobs past their wait limit and claimed jobs past their lease become `failed/interrupted` when the worker or a history/read operation reconciles them. Terminal payloads are cleared; expired workers cannot publish late results.

A process may crash after the provider accepted work. Such a job is **not automatically retried**: after expiry, the user can start a new attempt. This avoids duplicate inference and ambiguous billing/resource usage. The guarantee is a single accepted claim and at most one committed version, not exactly-once execution in an external model server. If the provider ignores an aborted connection, Nova cannot prove its compute stopped; its bounded lease is not a remote cancellation acknowledgement.

Deleting an unclaimed queued project releases its slot atomically through a database trigger. Claimed leases remain in the surviving attempt ledger after project/job deletion, so a long queue wait cannot shorten their deadline. Queued cancellation releases the local concurrency slot immediately because no worker has claimed it. Claimed cancellation holds the slot until worker settlement or lease expiry. A provider result arriving after cancellation, expiry, project deletion or a concurrent source change cannot publish. Existing rolling limits (3/account, 20/environment, 3 concurrent) remain in force, including failed/cancelled accepted attempts.

## Evidence

Store/worker tests cover reopening the database, independent-connection claiming, frozen source/requirements, owner isolation, payload cleanup, atomic rollback, cancellation, expiry, configuration mismatch, unsafe outputs and shutdown. The browser workflow starts a separate isolated app/database, enqueues through the real HTTP route, reloads, executes a worker in another process with explicitly injected fixture output, and observes persisted stages and source. It also verifies cancellation and English mobile layout. Fixtures do not prove actual model quality; local model validation remains pending on the user's hardware.
