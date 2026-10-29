import "server-only";
import { EnvHttpProxyAgent, fetch as proxyFetch } from "undici";
import {
  AIProviderError,
  freeModelConfig,
  generateFreeSource,
} from "./ai-provider";
import { generationRuns, projects, sourceVersions } from "./db";
import { SourceVersionError } from "./versions";
import { GenerationRunError, type GenerationRun } from "./generation-runs";

const dispatcher = new EnvHttpProxyAgent();
const controllers = new Map<string, AbortController>();
export function cancelGeneration(owner: string, project: string, id: string) {
  const run = generationRuns.cancel(owner, project, id);
  controllers.get(id)?.abort();
  return run;
}
export async function executeGeneration(
  owner: string,
  project: string,
  input: unknown,
  requestSignal: AbortSignal,
): Promise<GenerationRun> {
  const config = freeModelConfig();
  if (!config.configured) throw new AIProviderError("NOT_CONFIGURED");
  if (!config.freeOnly) throw new AIProviderError("FREE_MODEL_REQUIRED");
  const started = generationRuns.start(owner, project, input, config.model);
  if (!started.created) return started.run;
  const run = started.run;
  const controller = new AbortController();
  controllers.set(run.id, controller);
  const signal = AbortSignal.any([
    controller.signal,
    requestSignal,
    AbortSignal.timeout(90_000),
  ]);
  try {
    const current = run.base_version_id
      ? sourceVersions.get(owner, project, run.base_version_id)
      : null;
    const details = projects.get(owner, project);
    if (!details) throw new GenerationRunError("NOT_FOUND");
    const result = await generateFreeSource(
      { prompt: run.prompt, brief: details.brief, files: current?.files || [] },
      {
        apiKey: process.env.NOVA_AI_API_KEY!,
        model: config.model,
        signal,
        fetcher: async (url, init) =>
          proxyFetch(String(url), { ...init, dispatcher } as Parameters<
            typeof proxyFetch
          >[1]) as unknown as Promise<Response>,
      },
    );
    signal.throwIfAborted();
    return generationRuns.complete(
      owner,
      project,
      run.id,
      result.output,
      result.usage,
    );
  } catch (error) {
    const code = signal.aborted
      ? "INTERRUPTED"
      : error instanceof AIProviderError
        ? error.code
        : error instanceof SourceVersionError
          ? error.code === "CONFLICT"
            ? "SOURCE_CONFLICT"
            : "INVALID_FILES"
          : "GENERATION_FAILED";
    return generationRuns.fail(owner, project, run.id, code);
  } finally {
    controllers.delete(run.id);
  }
}
