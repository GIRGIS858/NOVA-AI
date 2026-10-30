import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { fetch as localFetch } from "undici";
import {
  ollamaProviderTransport,
  OLLAMA_ORIGIN,
} from "../src/lib/ollama-provider-http";
import { afterEach, expect, it, vi } from "vitest";
import { generateStaticSite } from "../src/lib/ai-provider";

afterEach(() => vi.unstubAllEnvs());
it("exercises the real loopback HTTP adapter against a fixture runtime, without external requests", async () => {
  vi.stubEnv("NOVA_AI_PROVIDER", "ollama");
  vi.stubEnv("NOVA_OLLAMA_MODEL", "fixture-local:7b");
  const paths: string[] = [];
  const bodies: string[] = [];
  const server = createServer(async (req, res) => {
    paths.push(req.url || "");
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    bodies.push(Buffer.concat(chunks).toString());
    res.setHeader("Content-Type", "application/json");
    res.end(
      JSON.stringify(
        req.url === "/api/show"
          ? { details: { parameter_size: "7B", quantization_level: "Q4" } }
          : {
              done: true,
              done_reason: "stop",
              message: {
                content: JSON.stringify({
                  html: "<h1>Loopback fixture</h1>",
                  css: "h1{color:teal}",
                }),
              },
            },
      ),
    );
  });
  // Use an ephemeral fixture port, preserving any real Ollama instance.
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  try {
    const fixtureOrigin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    const files = await generateStaticSite(
      {
        prompt: "Create an Arabic portfolio",
        apiKey: "never-forward-this",
        signal: AbortSignal.timeout(5000),
      },
      (body, key, signal) =>
        ollamaProviderTransport(body, key, signal, async (url, init) => {
          expect(String(url).startsWith(OLLAMA_ORIGIN + "/")).toBe(true);
          return localFetch(
            String(url).replace(OLLAMA_ORIGIN, fixtureOrigin),
            init as Parameters<typeof localFetch>[1],
          ) as unknown as Promise<Response>;
        }),
    );
    expect(files[0].content).toBe("<h1>Loopback fixture</h1>");
    expect(paths).toEqual(["/api/show", "/api/chat"]);
    expect(bodies.join("")).not.toContain("never-forward-this");
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
});
