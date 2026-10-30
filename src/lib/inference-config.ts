import { freeModelConfig } from "./free-model";

/** Server-owned configuration. No browser request may select a host or provider. */
export function inferenceConfig(
  env: Record<string, string | undefined> = process.env,
) {
  const provider = env.NOVA_AI_PROVIDER || "ollama";
  if (provider === "openrouter") {
    const config = freeModelConfig(env);
    return {
      provider,
      model: config.model,
      valid: config.freeOnly,
      label: "OpenRouter (free only)",
    };
  }
  const model = (env.NOVA_OLLAMA_MODEL || "").trim();
  return {
    provider,
    model,
    valid:
      provider === "ollama" &&
      /^[a-zA-Z0-9][a-zA-Z0-9_.:/-]{0,199}$/.test(model) &&
      !/cloud/i.test(model),
    label: provider === "ollama" ? "Ollama · local" : "Unconfigured",
  };
}
