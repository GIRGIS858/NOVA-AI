import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ollamaProviderTransport,
  OLLAMA_ORIGIN,
  LOCAL_INPUT_BYTES,
} from "../src/lib/ollama-provider-http";
import { generateStaticSite } from "../src/lib/ai-provider";
import { inferenceConfig } from "../src/lib/inference-config";
import { generationConfigured } from "../src/lib/generation-config";
const info = () =>
  Response.json({
    details: { parameter_size: "7B", quantization_level: "Q4_K_M" },
  });
const output = () =>
  Response.json({
    done: true,
    done_reason: "stop",
    message: {
      content: JSON.stringify({
        html: "<h1>Local website</h1>",
        css: "h1{color:teal}",
      }),
    },
  });
const body = {
  model: "qwen2.5-coder:7b",
  messages: [{ role: "user", content: "Build a site" }],
};
const signal = new AbortController().signal;
afterEach(() => vi.unstubAllEnvs());
beforeEach(() => {
  vi.stubEnv("NOVA_AI_PROVIDER", "ollama");
  vi.stubEnv("NOVA_OLLAMA_MODEL", body.model);
  vi.stubEnv("NOVA_AI_API_KEY", "");
});
describe("local inference (fixture responses, not model quality evidence)", () => {
  it("defaults to local inference and requires explicit model and activation, without a key", () => {
    expect(inferenceConfig({}).provider).toBe("ollama");
    expect(inferenceConfig({}).valid).toBe(false);
    vi.stubEnv("NOVA_AI_ENABLED", "0");
    expect(generationConfigured()).toBe(false);
    vi.stubEnv("NOVA_AI_ENABLED", "1");
    expect(generationConfigured()).toBe(true);
    for (const provider of ["typo", "https://attacker.test"]) {
      vi.stubEnv("NOVA_AI_PROVIDER", provider);
      expect(generationConfigured()).toBe(false);
    }
  });
  it("uses loopback only, verifies downloaded weights and never forwards a credential", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(info())
      .mockResolvedValueOnce(output());
    const files = await generateStaticSite(
      { prompt: "Build a portfolio", apiKey: "must-not-leak", signal },
      (request, key, signal) => {
        expect(key).toBe("");
        return ollamaProviderTransport(request, key, signal, fetcher);
      },
    );
    expect(files[0].content).toContain("Local website");
    expect(fetcher.mock.calls.map((call) => call[0])).toEqual([
      `${OLLAMA_ORIGIN}/api/show`,
      `${OLLAMA_ORIGIN}/api/chat`,
    ]);
    expect(JSON.stringify(fetcher.mock.calls)).not.toContain("must-not-leak");
    const request = JSON.parse(String(fetcher.mock.calls[1][1]?.body));
    expect(request.options).toMatchObject({
      num_ctx: 16384,
      num_predict: 4096,
    });
    expect(request.format.required).toEqual(["html", "css"]);
    expect(fetcher.mock.calls[1][1]?.redirect).toBe("error");
  });
  it("reports an unavailable runtime without remote fallback", async () => {
    const fetcher = vi
      .fn()
      .mockRejectedValue(new TypeError("Connection refused"));
    await expect(
      ollamaProviderTransport(body, "", signal, fetcher),
    ).rejects.toMatchObject({ code: "local_model_unavailable" });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("rejects cloud names before contacting any runtime", async () => {
    const fetcher = vi.fn();
    await expect(
      ollamaProviderTransport(
        { ...body, model: "large:cloud" },
        "",
        signal,
        fetcher,
      ),
    ).rejects.toMatchObject({ code: "not_configured" });
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("rejects remote model metadata without inference or fallback", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      Response.json({
        remote_host: "https://cloud.example",
        details: { parameter_size: "7B", quantization_level: "Q4" },
      }),
    );
    await expect(
      ollamaProviderTransport(body, "", signal, fetcher),
    ).rejects.toMatchObject({ code: "local_model_unavailable" });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("rejects oversized context before any model request", async () => {
    const fetcher = vi.fn();
    await expect(
      ollamaProviderTransport(
        { ...body, messages: ["a".repeat(LOCAL_INPUT_BYTES)] },
        "",
        signal,
        fetcher,
      ),
    ).rejects.toMatchObject({ code: "context_limit" });
    expect(fetcher).not.toHaveBeenCalled();
  });
  it.each([
    null,
    { done: false },
    { done: true, done_reason: "length", message: { content: "{}" } },
  ])("rejects incomplete output %#", async (result) => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(info())
      .mockResolvedValueOnce(Response.json(result));
    await expect(
      ollamaProviderTransport(body, "", signal, fetcher),
    ).rejects.toMatchObject({ code: "invalid_output" });
  });
  it("limits response bytes", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(info())
      .mockResolvedValueOnce(new Response("x".repeat(512_001)));
    await expect(
      ollamaProviderTransport(body, "", signal, fetcher),
    ).rejects.toMatchObject({ code: "invalid_output" });
  });
  it("maps absent models and cancellation without retry", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 404 }));
    await expect(
      ollamaProviderTransport(body, "", signal, fetcher),
    ).rejects.toMatchObject({ code: "local_model_unavailable" });
    fetcher.mockClear();
    await expect(
      ollamaProviderTransport(body, "", AbortSignal.abort(), fetcher),
    ).rejects.toBeDefined();
    expect(fetcher).not.toHaveBeenCalled();
  });
});
