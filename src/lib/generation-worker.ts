import type { generationQueue } from "./generation-queue";
import { generateStaticSite, ProviderError } from "./ai-provider";
import { GenerationStoreError } from "./generation-store";
import { buildPreview } from "./static-artifact";

/** One bounded job per worker. No browser lifetime and no automatic inference retries. */
export async function processNextGeneration(
  queue: ReturnType<typeof generationQueue>,
  options: {
    provider: string;
    model: string;
    apiKey: string;
    signal: AbortSignal;
    generate?: typeof generateStaticSite;
  },
) {
  if (options.signal.aborted) return false;
  const claim = queue.claim();
  if (!claim) return false;
  const cancelled = new AbortController();
  const signal = AbortSignal.any([
    options.signal,
    cancelled.signal,
    AbortSignal.timeout(90_000),
  ]);
  const timer = setInterval(() => {
    try {
      if (!queue.active(claim)) cancelled.abort();
    } catch {
      cancelled.abort();
    }
  }, 250);
  try {
    if (claim.provider !== options.provider || claim.model !== options.model) {
      queue.settle(claim, "configuration_changed");
      return true;
    }
    signal.throwIfAborted();
    const files = await (options.generate || generateStaticSite)({
      prompt: claim.prompt,
      source: claim.source,
      apiKey: options.apiKey,
      signal,
    });
    signal.throwIfAborted();
    if (!queue.validating(claim)) return true;
    buildPreview(files);
    queue.complete(claim, files);
  } catch (error) {
    const code = options.signal.aborted
      ? "interrupted"
      : signal.aborted
        ? signal.reason?.name === "TimeoutError"
          ? "timeout"
          : "cancelled"
        : error instanceof ProviderError ||
            error instanceof GenerationStoreError
          ? error.code
          : "invalid_output";
    queue.settle(claim, code);
  } finally {
    clearInterval(timer);
    queue.settle(claim, "internal_error");
  }
  return true;
}
