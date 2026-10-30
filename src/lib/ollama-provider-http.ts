import { fetch as localFetch } from "undici";
import { boundedJSON } from "./free-provider-http";
import { ProviderError } from "./provider-error";
import { inferenceConfig } from "./inference-config";

export const OLLAMA_ORIGIN = "http://127.0.0.1:11434";
export const LOCAL_OUTPUT_TOKENS = 4096;
// Conservative byte budget leaves room for output and chat template in 16K context.
export const LOCAL_INPUT_BYTES = 10_000;
const defaultFetch: typeof fetch = (url, init) =>
  localFetch(
    String(url),
    init as Parameters<typeof localFetch>[1],
  ) as unknown as Promise<Response>;

/** Loopback-only, downloaded models only. Never sends credentials or falls back remotely. */
export async function ollamaProviderTransport(
  body: Record<string, unknown>,
  _unusedKey: string,
  signal: AbortSignal,
  fetcher: typeof fetch = defaultFetch,
): Promise<unknown> {
  const config = inferenceConfig({
    NOVA_AI_PROVIDER: "ollama",
    NOVA_OLLAMA_MODEL: String(body.model || ""),
  });
  if (!config.valid) throw new ProviderError("not_configured");
  if (
    Buffer.byteLength(JSON.stringify(body.messages), "utf8") > LOCAL_INPUT_BYTES
  )
    throw new ProviderError("context_limit");
  signal.throwIfAborted();
  const request = async (path: string, payload: unknown) => {
    let response: Response;
    try {
      response = await fetcher(`${OLLAMA_ORIGIN}${path}`, {
        method: "POST",
        redirect: "error",
        signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } catch (error) {
      if (signal.aborted) throw error;
      throw new ProviderError("local_model_unavailable");
    }
    if (!response.ok) {
      await response.body?.cancel();
      throw new ProviderError(
        response.status === 404 ? "local_model_unavailable" : "provider_error",
      );
    }
    return boundedJSON(response, 512_000);
  };
  const info = (await request("/api/show", { model: config.model })) as {
    remote_model?: unknown;
    remote_host?: unknown;
    details?: { parameter_size?: string; quantization_level?: string };
  } | null;
  if (
    !info ||
    info.remote_model ||
    info.remote_host ||
    !info.details?.parameter_size ||
    !info.details.quantization_level
  )
    throw new ProviderError("local_model_unavailable");
  const result = (await request("/api/chat", {
    model: config.model,
    messages: body.messages,
    stream: false,
    format: {
      type: "object",
      properties: { html: { type: "string" }, css: { type: "string" } },
      required: ["html", "css"],
      additionalProperties: false,
    },
    options: {
      num_ctx: 16384,
      num_predict: LOCAL_OUTPUT_TOKENS,
      temperature: 0.2,
    },
  })) as {
    done?: boolean;
    done_reason?: string;
    message?: { content?: unknown };
  } | null;
  if (
    !result ||
    result.done !== true ||
    result.done_reason !== "stop" ||
    typeof result.message?.content !== "string"
  )
    throw new ProviderError("invalid_output");
  return {
    choices: [
      { finish_reason: "stop", message: { content: result.message.content } },
    ],
  };
}
