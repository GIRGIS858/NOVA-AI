import { freeModelConfig } from "@/lib/free-model";
import { generationConfigured } from "@/lib/generation-config";
import { generations } from "@/lib/db";
import { authorizeProject, json } from "@/lib/generation-http";
export const runtime = "nodejs";
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const auth = await authorizeProject(id);
  if (auth.response) return auth.response;
  return json({
    runs: generations.runs(auth.owner!, id),
    versions: generations.versions(auth.owner!, id),
    configured: generationConfigured(),
    model: freeModelConfig().model,
  });
}
