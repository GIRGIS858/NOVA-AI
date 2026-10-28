import nextEnv from "@next/env";
nextEnv.loadEnvConfig(process.cwd());
const { generateStaticSite, AI_MODEL } = await import("../src/lib/ai-provider");
const { buildPreview } = await import("../src/lib/static-artifact");
const apiKey = process.env.NOVA_AI_API_KEY;
if (!apiKey) {
  console.error(
    "NOVA_AI_API_KEY is missing. Configure it securely before running this live provider check.",
  );
  process.exitCode = 1;
} else {
  try {
    const files = await generateStaticSite({
      apiKey,
      signal: AbortSignal.timeout(60000),
      prompt:
        "Create a small static portfolio for a fictional design studio named Nova Test. Include a heading, three projects, and a contact section with no form or external links.",
    });
    const preview = buildPreview(files);
    console.log(
      JSON.stringify({
        provider: "OpenAI",
        model: AI_MODEL,
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
      "Live provider validation failed. No source was executed or published. Check the configured credential, network access and provider account.",
    );
    process.exitCode = 1;
  }
}
