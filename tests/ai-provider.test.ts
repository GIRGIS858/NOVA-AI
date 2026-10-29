import { describe, expect, it, vi } from "vitest";
import { DEFAULT_FREE_MODEL, generateFreeSource } from "../src/lib/ai-provider";
const source = {
  summary: "Build a site",
  changes: [{ type: "write", path: "index.html", content: "<h1>Hello</h1>" }],
};
const catalog = (pricing = { prompt: "0", completion: "0" }) =>
  Response.json({ data: [{ id: DEFAULT_FREE_MODEL, pricing }] });
function response(content = JSON.stringify(source), finish = "stop") {
  return Response.json({
    choices: [{ finish_reason: finish, message: { content } }],
    usage: { prompt_tokens: 150, completion_tokens: 200 },
  });
}
const input = {
  prompt: "Build a portfolio website",
  brief: "A designer portfolio",
  files: [],
};
const opts = (fetcher: typeof fetch) => ({
  apiKey: "unit-test-placeholder",
  model: DEFAULT_FREE_MODEL,
  signal: AbortSignal.timeout(5000),
  fetcher,
});
describe("free-only OpenRouter adapter (mocked HTTP, no real inference)", () => {
  it("requires a key and a free model before network access", async () => {
    const fetcher = vi.fn();
    await expect(
      generateFreeSource(input, { ...opts(fetcher), apiKey: "" }),
    ).rejects.toThrow("NOT_CONFIGURED");
    await expect(
      generateFreeSource(input, { ...opts(fetcher), model: "provider/paid" }),
    ).rejects.toThrow("FREE_MODEL_REQUIRED");
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("checks current zero pricing and sends no paid fallback", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(catalog())
      .mockResolvedValueOnce(response());
    const r = await generateFreeSource(input, opts(fetcher));
    expect(r.output).toEqual(source);
    expect(r.usage.inputTokens).toBe(150);
    const request = JSON.parse(fetcher.mock.calls[1][1].body);
    expect(request.provider).toEqual({
      allow_fallbacks: false,
      max_price: { prompt: 0, completion: 0 },
    });
    expect(request.model).toBe(DEFAULT_FREE_MODEL);
    expect(fetcher.mock.calls[1][1].redirect).toBe("error");
  });
  it("refuses paid, unknown, or removed models", async () => {
    for (const res of [
      catalog({ prompt: "0.1", completion: "0" }),
      Response.json({ data: [] }),
      Response.json({
        data: [
          {
            id: DEFAULT_FREE_MODEL,
            pricing: { prompt: "0", completion: "0", request: "1" },
          },
        ],
      }),
    ]) {
      const f = vi.fn().mockResolvedValue(res);
      await expect(generateFreeSource(input, opts(f))).rejects.toThrow(
        "FREE_MODEL_UNAVAILABLE",
      );
      expect(f).toHaveBeenCalledTimes(1);
    }
  });
  it.each([
    [429, "RATE_LIMITED"],
    [401, "AUTH_FAILED"],
    [403, "AUTH_FAILED"],
    [503, "PROVIDER_UNAVAILABLE"],
  ])("maps HTTP %s to safe errors", async (status, code) => {
    const f = vi
      .fn()
      .mockResolvedValueOnce(catalog())
      .mockResolvedValueOnce(
        new Response("private upstream error with credential", {
          status: Number(status),
        }),
      );
    await expect(generateFreeSource(input, opts(f))).rejects.toThrow(
      String(code),
    );
    expect(f).toHaveBeenCalledTimes(2);
  });
  it("rejects truncated, malformed, and schema-invalid responses", async () => {
    for (const res of [
      response("{}", "length"),
      response("not json"),
      response('{"summary":"a","changes":[]}'),
    ]) {
      const f = vi
        .fn()
        .mockResolvedValueOnce(catalog())
        .mockResolvedValueOnce(res);
      await expect(generateFreeSource(input, opts(f))).rejects.toThrow();
    }
  });
  it("rejects large context and oversized responses before parsing them", async () => {
    const f = vi.fn().mockResolvedValueOnce(catalog());
    await expect(
      generateFreeSource({ ...input, brief: "x".repeat(180001) }, opts(f)),
    ).rejects.toThrow("CONTEXT_LIMIT");
    expect(f).toHaveBeenCalledTimes(1);
    const huge = vi
      .fn()
      .mockResolvedValueOnce(catalog())
      .mockResolvedValueOnce(new Response("x".repeat(2 * 1024 * 1024 + 1)));
    await expect(generateFreeSource(input, opts(huge))).rejects.toThrow(
      "RESPONSE_LIMIT",
    );
  });
});
