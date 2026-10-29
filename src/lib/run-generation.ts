import { GenerationStoreError, type generationStore } from "./generation-store";
import { type projectStore } from "./projects";
import {
  type generateStaticSite,
  ProviderError,
  MAX_PROMPT_CHARS,
} from "./ai-provider";
import { buildPreview } from "./static-artifact";
import {
  generationContext,
  latestNotesWithinBudget,
} from "./generation-context";

export async function runGeneration(
  input: {
    owner: string;
    projectId: string;
    requestId: string;
    apiKey: string;
    signal: AbortSignal;
  },
  deps: {
    generations: ReturnType<typeof generationStore>;
    projects: ReturnType<typeof projectStore>;
    provider: typeof generateStaticSite;
  },
) {
  const { generations, projects, provider } = deps;
  const reservation = generations.reserve(
    input.owner,
    input.projectId,
    input.requestId,
  );
  if (reservation.existing) return { run: reservation.run };
  const runId = reservation.run.id;
  const cancelled = new AbortController();
  const signal = AbortSignal.any([
    input.signal,
    cancelled.signal,
    AbortSignal.timeout(90000),
  ]);
  const timer = setInterval(() => {
    if (generations.getRun(input.owner, runId)?.status !== "running")
      cancelled.abort();
  }, 250);
  timer.unref();
  try {
    const project = projects.get(input.owner, input.projectId);
    if (!project) {
      cancelled.abort();
      throw new ProviderError("cancelled");
    }
    const notes = projects
      .recentMessages(input.owner, input.projectId)
      .map((note) => note.content)
      .join("\n\n");
    const prefix = `Project: ${project.name}\nBrief:\n${project.brief}\n\nLatest saved notes (older content may be omitted):\n`;
    const prompt =
      prefix + latestNotesWithinBudget(notes, MAX_PROMPT_CHARS - prefix.length);
    // Fail before contacting a provider if the complete captured snapshot cannot fit.
    generationContext(prompt, reservation.source);
    signal.throwIfAborted();
    const files = await provider({
      prompt,
      source: reservation.source,
      apiKey: input.apiKey,
      signal,
    });
    if (signal.aborted)
      throw new ProviderError(
        signal.reason?.name === "TimeoutError" ? "timeout" : "cancelled",
      );
    // The artifact build performs validation and sanitation only, never executes generated code.
    buildPreview(files);
    const version = generations.complete(input.owner, runId, files);
    return {
      run: generations.getRun(input.owner, runId),
      version: version
        ? {
            id: version.id,
            created_at: version.created_at,
            run_id: version.run_id,
          }
        : undefined,
    };
  } catch (error) {
    const code = signal.aborted
      ? signal.reason?.name === "TimeoutError"
        ? "timeout"
        : "cancelled"
      : error instanceof ProviderError || error instanceof GenerationStoreError
        ? error.code
        : "invalid_output";
    if (code === "cancelled")
      generations.cancel(input.owner, input.projectId, runId);
    else generations.fail(input.owner, runId, code);
    return { run: generations.getRun(input.owner, runId) };
  } finally {
    clearInterval(timer);
    generations.release(input.owner, runId);
  }
}
