import { inferenceConfig } from "./inference-config";
/** Configuration gate, not proof of model health. Enable after real smoke validation. */
export function generationConfigured() {
  const config = inferenceConfig();
  return (
    process.env.NOVA_AI_ENABLED === "1" &&
    config.valid &&
    (config.provider === "ollama" || Boolean(process.env.NOVA_AI_API_KEY))
  );
}
