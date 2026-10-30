import nextEnv from "@next/env";
import { setTimeout as delay } from "node:timers/promises";
nextEnv.loadEnvConfig(process.cwd());
const { db } = await import("../src/lib/db");
const { generationQueue } = await import("../src/lib/generation-queue");
const { processNextGeneration } = await import("../src/lib/generation-worker");
const { generationConfigured } = await import("../src/lib/generation-config");
const { inferenceConfig } = await import("../src/lib/inference-config");
const shutdown = new AbortController();
process.once("SIGINT", () => shutdown.abort());
process.once("SIGTERM", () => shutdown.abort());
try {
  // Fail with a useful setup error instead of creating schemas during worker startup.
  db.prepare("SELECT run_id FROM generation_jobs LIMIT 1").get();
  const queue = generationQueue(db);
  console.log(
    "Nova generation worker started. Waiting for enabled, queued work.",
  );
  while (!shutdown.signal.aborted) {
    queue.reconcile();
    const config = inferenceConfig();
    const handled =
      generationConfigured() &&
      (await processNextGeneration(queue, {
        provider: config.provider,
        model: config.model,
        apiKey: process.env.NOVA_AI_API_KEY || "",
        signal: shutdown.signal,
      }));
    if (!handled)
      await delay(750, undefined, { signal: shutdown.signal }).catch(() => {});
  }
} catch {
  console.error(
    "Generation worker stopped unexpectedly. Check database access and run npm run db:migrate before restarting. No provider details or private payloads logged.",
  );
  process.exitCode = 1;
} finally {
  db.close();
}
