# Nova: full-stack platform delivery plan

## Product direction — 30 October 2026

Build a substantial Arabic/English AI application builder owned by the user, with a premium dark workspace. The target is a complete product comparable in scope to conversational app builders, not just static page generation. Current working features are a starting foundation, not evidence of full-stack execution or production readiness.

The user now requires locally hosted AI without external provider subscriptions or keys. Initial hardware: 16 GB system RAM and RTX 5070; OS, exact VRAM and free disk remain unconfirmed. Start with a downloaded 7B coding model, benchmark before selecting it permanently, and increase model/context size only from measured memory headroom. A 7B model is not assumed to match frontier hosted systems. Model license, quality, latency and operating cost must be recorded. The app communicates with the local model runtime internally; “no API key” does not mean software components cannot communicate.

## Delivery milestones and acceptance criteria

| Milestone | Deliverable | Required evidence |
| --- | --- | --- |
| 1. Local inference | Downloaded model through Ollama, no remote fallback, explicit activation, useful diagnostics | Actual create/edit prompts on the user's machine; Arabic/English quality, time and VRAM recorded; no source truncation or unwanted network calls |
| 2. Durable agent work | Separate job worker, persisted stages/events, plan → edits → validation → repair loop, streamed progress | Restart during a run without duplicate commits, cancellation, bounded repair iterations, concurrency and ownership tests |
| 3. Full-stack project workspace | Multi-file React/TypeScript projects, dependency manifests, source tree, focused patches and version history | Reproducible builds, stale-edit rejection, file/path/size boundaries, whole-project export |
| 4. Isolated execution | Separate execution host using a reviewed container/microVM boundary, install/build/test jobs, preview service | Untrusted code cannot read control-plane files/secrets or cross tenant boundaries; CPU/RAM/disk/time/network limits; cleanup and crash recovery |
| 5. Application data | PostgreSQL migrations, tenant-scoped databases/access, development secrets and object storage | Backup/restore drills, cross-project denial, migrations rollback/recovery and preview-vs-production separation |
| 6. Publish and operate | Reviewed deploy action, immutable artifacts, domains/TLS, deployment logs and rollback | Successful deploy/health/rollback lifecycle, DNS failure recovery, explicit state instead of pretend success |
| 7. Complete product | Teams/roles, invitations, email verification/recovery, audit logs, account export/delete, admin controls | Permission matrix, accessibility, responsive Arabic/English, abuse and quota tests |
| 8. Production release | Monitoring, alerting, capacity testing, retention/backups, upgrade/incident procedures | Load tests and a documented restore exercise; external security review before broad public signup |

## Architecture decisions

- Keep Next.js as the control plane and UI; generated application code must never run inside it.
- The initial local topology runs Nova and Ollama on the same user machine. A cloud Nova server cannot access a user's laptop via its own localhost. A future authenticated local worker connection requires a separate reviewed design.
- Introduce a durable queue and separate orchestration worker before extending jobs beyond HTTP request lifetimes. PostgreSQL will become the shared source of truth; introduce migrations and tests before replacing the current SQLite foundation. Redis may support queue delivery, never be the only record of accepted work.
- Store immutable version/build/deployment artifacts separately from database metadata. Tie every worker result to its project, run, captured source version and lease.
- Start with one supported full-stack template (React/TypeScript frontend plus a Node service and PostgreSQL) before expanding frameworks. Report unsupported operations clearly.
- Execution workers must have no host Docker socket, control-plane credentials or writable source checkout. Sandbox selection depends on the available deployment host; merely running arbitrary generated code in a process is unacceptable.
- Model upgrades require a bilingual benchmark set: initial site, preservation edit, multi-file change, failing-test repair, Arabic RTL and adversarial instructions. Record correctness and edit preservation, not only appearance.
- Keep UI statuses honest: model configured is distinct from model reachable, generated is distinct from built, and preview is distinct from published.

## Current checkpoint and next session

Implemented the local Ollama adapter and default provider selection, reusing existing ownership, cancellation, immutable snapshots and artifact validation. Local generation still produces HTML/CSS only. No real model inference or quality benchmark has run in the cloud environment. Durable job execution and phase events are now implemented; see GENERATION-WORKER.md. Complete the hardware smoke check next, then extend the project format toward multi-file full-stack projects and a separately isolated build runner. The existing 90-second generation deadline and attempt limits remain; change these together with lease recovery and resource controls, not in isolation.

Each session should finish a tested vertical slice and update HANDOFF.md. Work resumes in explicit sessions; this document is not a promise of unattended development over months.
