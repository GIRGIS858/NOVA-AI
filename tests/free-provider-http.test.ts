import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import {
  freeProviderTransport,
  AI_ENDPOINT,
} from "../src/lib/free-provider-http";
import { DEFAULT_FREE_MODEL, freeModelConfig } from "../src/lib/free-model";
import { generationConfigured } from "../src/lib/generation-config";
const body = {
  model: DEFAULT_FREE_MODEL,
  messages: [{ role: "user", content: "Build a site" }],
};
const signal = new AbortController().signal;
const catalog = (
  pricing: unknown = { prompt: "0", completion: "0" },
  extra = {},
) => Response.json({ data: [{ id: DEFAULT_FREE_MODEL, pricing, ...extra }] });
const call = (fetcher: typeof fetch, request = body, key = "test-key") =>
  freeProviderTransport(request, key, signal, fetcher);
afterEach(() => vi.unstubAllEnvs());

describe("free-only transport (mocked HTTP; never live inference)", () => {
  it("requires explicit activation, a key, and a :free model", async () => {
    vi.stubEnv("NOVA_AI_ENABLED", "1");
    vi.stubEnv("NOVA_AI_API_KEY", "test-key");
    vi.stubEnv("NOVA_AI_MODEL", DEFAULT_FREE_MODEL);
    expect(generationConfigured()).toBe(true);
    vi.stubEnv("NOVA_AI_MODEL", "openai/paid");
    expect(generationConfigured()).toBe(false);
    expect(freeModelConfig({}).model).toBe(DEFAULT_FREE_MODEL);
    const fetcher = vi.fn();
    await expect(
      call(fetcher, { ...body, model: "openai/paid" }),
    ).rejects.toMatchObject({ code: "free_model_required" });
    await expect(call(fetcher, body, "")).rejects.toMatchObject({
      code: "not_configured",
    });
    expect(fetcher).not.toHaveBeenCalled();
    vi.stubEnv("NOVA_AI_MODEL", DEFAULT_FREE_MODEL);
    vi.stubEnv("NOVA_AI_API_KEY", "");
    expect(generationConfigured()).toBe(false);
    vi.stubEnv("NOVA_AI_API_KEY", "test-key");
    vi.stubEnv("NOVA_AI_ENABLED", "0");
    expect(generationConfigured()).toBe(false);
  });
  it("verifies the catalog without credentials before a zero-priced inference", async () => {
    const f = vi
      .fn()
      .mockResolvedValueOnce(catalog())
      .mockResolvedValueOnce(Response.json({ choices: [] }));
    await call(f);
    expect(f).toHaveBeenCalledTimes(2);
    expect(f.mock.calls[0][0]).toBe("https://openrouter.ai/api/v1/models");
    expect(f.mock.calls[0][1]).toEqual({ signal, redirect: "error" });
    expect(f.mock.calls[1][0]).toBe(AI_ENDPOINT);
    const init = f.mock.calls[1][1];
    expect(init.headers.Authorization).toBe("Bearer test-key");
    expect(init.signal).toBe(signal);
    expect(init.redirect).toBe("error");
    const payload = JSON.parse(init.body);
    expect(payload.model).toBe(DEFAULT_FREE_MODEL);
    expect(payload.provider).toEqual({
      allow_fallbacks: false,
      max_price: { prompt: 0, completion: 0 },
    });
    expect(init.body).not.toContain("test-key");
  });
  it.each([
    { prompt: "0.001", completion: "0" },
    { prompt: "0", completion: "0", request: "1" },
    { prompt: "0", completion: "0", image: "0.1" },
    { prompt: 0, completion: 0 },
    { prompt: "", completion: "0" },
    { prompt: "0" },
    null,
  ])("fails closed on nonzero or invalid pricing %j", async (pricing) => {
    const f = vi.fn().mockResolvedValueOnce(catalog(pricing));
    await expect(call(f)).rejects.toMatchObject({
      code: "free_model_unavailable",
    });
    expect(f).toHaveBeenCalledTimes(1);
  });
  it("refuses removed or expired models and unavailable catalog", async () => {
    for (const [response, code] of [
      [Response.json({ data: [] }), "free_model_unavailable"],
      [
        catalog(undefined, { expiration_date: "2000-01-01" }),
        "free_model_unavailable",
      ],
      [
        new Response("private upstream details", { status: 503 }),
        "catalog_unavailable",
      ],
    ] as const) {
      const f = vi.fn().mockResolvedValueOnce(response);
      await expect(call(f)).rejects.toMatchObject({ code });
      expect(f).toHaveBeenCalledTimes(1);
    }
  });
  it.each([
    [429, "rate_limited"],
    [401, "auth_failed"],
    [403, "auth_failed"],
    [503, "provider_error"],
  ])("maps %s without retrying or leaking details", async (status, code) => {
    const f = vi
      .fn()
      .mockResolvedValueOnce(catalog())
      .mockResolvedValueOnce(
        new Response("private credentials in upstream error", {
          status: Number(status),
        }),
      );
    await expect(call(f)).rejects.toMatchObject({ code, message: code });
    expect(f).toHaveBeenCalledTimes(2);
  });
  it("bounds catalog and output streams before JSON parsing", async () => {
    const f = vi
      .fn()
      .mockResolvedValueOnce(new Response("x".repeat(4 * 1024 * 1024 + 1)));
    await expect(call(f)).rejects.toMatchObject({ code: "invalid_output" });
    expect(f).toHaveBeenCalledTimes(1);
    const g = vi
      .fn()
      .mockResolvedValueOnce(catalog())
      .mockResolvedValueOnce(new Response("x".repeat(512001)));
    await expect(call(g)).rejects.toMatchObject({ code: "invalid_output" });
  });
});

beforeEach(() => vi.stubEnv("NOVA_AI_PROVIDER", "openrouter"));
