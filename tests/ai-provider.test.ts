import { describe, expect, it, vi } from "vitest";
import {
  generateStaticSite,
  AI_MODEL,
  MAX_OUTPUT_TOKENS,
  MAX_PROMPT_CHARS,
  ProviderError,
  type ProviderTransport,
} from "../src/lib/ai-provider";
const response = (content: string, finish_reason = "stop") => ({
  choices: [{ finish_reason, message: { content, refusal: null } }],
});
const input = () => ({
  prompt: "Build a clean Arabic architecture portfolio",
  apiKey: "unit-test-credential",
  signal: new AbortController().signal,
});
describe("OpenAI adapter with mocked transport (no live API calls)", () => {
  it("sets bounded structured output and never embeds credentials in model messages", async () => {
    const transport = vi
      .fn<ProviderTransport>()
      .mockResolvedValue(
        response(
          JSON.stringify({ html: "<h1>Portfolio</h1>", css: "h1{color:teal}" }),
        ),
      );
    const files = await generateStaticSite(input(), transport);
    expect(files.map((f) => f.path)).toEqual(["index.html", "styles.css"]);
    const body = transport.mock.calls[0][0];
    expect(body.model).toBe(AI_MODEL);
    expect(body.max_completion_tokens).toBe(MAX_OUTPUT_TOKENS);
    expect(body.store).toBe(false);
    expect(JSON.stringify(body)).not.toContain("unit-test-credential");
  });
  it.each([
    response('{"html":"<h1>Draft</h1>","css":""}', "length"),
    response("not json"),
    response('{"html":"<h1>Draft</h1>","css":"","script":"no"}'),
    {
      choices: [
        {
          finish_reason: "stop",
          message: { content: "{}", refusal: "refused" },
        },
      ],
    },
    response(JSON.stringify({ html: "a".repeat(110000), css: "" })),
  ])(
    "rejects incomplete, invalid, refused or oversized responses",
    async (payload) => {
      await expect(
        generateStaticSite(input(), async () => payload),
      ).rejects.toMatchObject({ code: "invalid_output" });
    },
  );
  it("rejects an oversized prompt before a remote call", async () => {
    const transport = vi.fn<ProviderTransport>();
    await expect(
      generateStaticSite(
        { ...input(), prompt: "a".repeat(MAX_PROMPT_CHARS + 1) },
        transport,
      ),
    ).rejects.toBeInstanceOf(ProviderError);
    expect(transport).not.toHaveBeenCalled();
  });
  it("returns a safe code and makes no automatic retry after provider failure", async () => {
    const transport = vi
      .fn<ProviderTransport>()
      .mockRejectedValue(new Error("private provider details"));
    await expect(generateStaticSite(input(), transport)).rejects.toMatchObject({
      code: "provider_error",
      message: "provider_error",
    });
    expect(transport).toHaveBeenCalledTimes(1);
  });
  it("distinguishes cancellation and timeout without exposing raw errors", async () => {
    for (const name of ["AbortError", "TimeoutError"]) {
      const signal = AbortSignal.abort(new DOMException("stopped", name));
      await expect(
        generateStaticSite({ ...input(), signal }, async () => {
          throw new Error("raw");
        }),
      ).rejects.toMatchObject({
        code: name === "TimeoutError" ? "timeout" : "cancelled",
      });
    }
  });
});
