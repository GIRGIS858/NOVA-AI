import { freeModelConfig } from "./free-model";
/** Enable only after a real provider smoke check; keys stay exclusively server-side. */
export function generationConfigured() {
  return (
    process.env.NOVA_AI_ENABLED === "1" &&
    Boolean(process.env.NOVA_AI_API_KEY) &&
    freeModelConfig().freeOnly
  );
}
