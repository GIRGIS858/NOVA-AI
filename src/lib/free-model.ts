/** Server configuration only; neither the key nor arbitrary endpoints reach clients. */
export const DEFAULT_FREE_MODEL = "thinkingmachines/inkling:free";
export function freeModelConfig(
  env: Record<string, string | undefined> = process.env,
) {
  const model = env.NOVA_AI_MODEL || DEFAULT_FREE_MODEL;
  return {
    model,
    freeOnly: /^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.:-]+:free$/.test(model),
  };
}
