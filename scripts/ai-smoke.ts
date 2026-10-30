import nextEnv from "@next/env";
nextEnv.loadEnvConfig(process.cwd());
const { generateStaticSite } = await import("../src/lib/ai-provider");
const { inferenceConfig } = await import("../src/lib/inference-config");
const config = inferenceConfig();
const { buildPreview } = await import("../src/lib/static-artifact");
const apiKey = process.env.NOVA_AI_API_KEY || "";
if (!config.valid || (config.provider === "openrouter" && !apiKey)) {
  console.error(
    "Configure NOVA_OLLAMA_MODEL for local inference, or explicitly select and configure the optional OpenRouter provider.",
  );
  process.exitCode = 1;
} else {
  try {
    const files = await generateStaticSite({
      apiKey,
      signal: AbortSignal.timeout(90000),
      prompt:
        "Create a small static portfolio for a fictional design studio named Nova Test. Include a heading, three projects, and a contact section with no form or external links.",
    });
    const preview = buildPreview(files);
    console.log(
      JSON.stringify({
        provider: config.label,
        model: config.model,
        liveProvider: true,
        validatedFiles: files.map((f) => ({
          path: f.path,
          bytes: Buffer.byteLength(f.content, "utf8"),
        })),
        previewBytes: Buffer.byteLength(preview, "utf8"),
      }),
    );
  } catch {
    console.error(
      "Live provider validation failed. No source was executed or published. Check the selected model, its runtime and hardware. Local inference requires Ollama on the same machine.",
    );
    process.exitCode = 1;
  }
}
