import { EnvHttpProxyAgent, fetch as proxyFetch } from "undici";
import { freeModelConfig } from "./free-model";
import { ProviderError } from "./provider-error";

export const AI_ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";
const CATALOG_ENDPOINT = "https://openrouter.ai/api/v1/models";
let dispatcher: EnvHttpProxyAgent | undefined;
const defaultFetch: typeof fetch = async (url, init) => {
  dispatcher ||= new EnvHttpProxyAgent();
  return proxyFetch(String(url), { ...init, dispatcher } as Parameters<
    typeof proxyFetch
  >[1]) as unknown as Promise<Response>;
};

export async function boundedJSON(
  response: Response,
  maxBytes: number,
): Promise<unknown> {
  const reader = response.body?.getReader();
  if (!reader) throw new ProviderError("invalid_output");
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > maxBytes) {
        await reader.cancel();
        throw new ProviderError("invalid_output");
      }
      chunks.push(value);
    }
    try {
      return JSON.parse(Buffer.concat(chunks).toString("utf8"));
    } catch {
      throw new ProviderError("invalid_output");
    }
  } finally {
    reader.releaseLock();
  }
}

/** Fixed HTTPS destinations; verify live zero pricing before every inference. */
export async function freeProviderTransport(
  body: Record<string, unknown>,
  apiKey: string,
  signal: AbortSignal,
  fetcher: typeof fetch = defaultFetch,
): Promise<unknown> {
  if (!apiKey) throw new ProviderError("not_configured");
  if (
    typeof body.model !== "string" ||
    !freeModelConfig({ NOVA_AI_MODEL: body.model }).freeOnly
  )
    throw new ProviderError("free_model_required");
  const catalog = await fetcher(CATALOG_ENDPOINT, {
    signal,
    redirect: "error",
  });
  if (!catalog.ok) {
    await catalog.body?.cancel();
    throw new ProviderError("catalog_unavailable");
  }
  const payload = (await boundedJSON(catalog, 4 * 1024 * 1024)) as {
    data?: Array<{
      id?: string;
      pricing?: Record<string, unknown>;
      expiration_date?: string | null;
    }>;
  } | null;
  const selected = Array.isArray(payload?.data)
    ? payload.data.find((item) => item?.id === body.model)
    : undefined;
  const zero = (value: unknown) =>
    typeof value === "string" && /^0(?:\.0+)?$/.test(value);
  if (
    !selected?.pricing ||
    !zero(selected.pricing.prompt) ||
    !zero(selected.pricing.completion) ||
    !Object.values(selected.pricing).every(zero) ||
    (selected.expiration_date &&
      selected.expiration_date <= new Date().toISOString().slice(0, 10))
  )
    throw new ProviderError("free_model_unavailable");

  const response = await fetcher(AI_ENDPOINT, {
    method: "POST",
    signal,
    redirect: "error",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      ...body,
      provider: {
        allow_fallbacks: false,
        max_price: { prompt: 0, completion: 0 },
      },
    }),
  });
  if (!response.ok) {
    await response.body?.cancel();
    throw new ProviderError(
      response.status === 429
        ? "rate_limited"
        : response.status === 401 || response.status === 403
          ? "auth_failed"
          : "provider_error",
    );
  }
  return boundedJSON(response, 512_000);
}
