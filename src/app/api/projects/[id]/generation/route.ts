import { inferenceConfig } from "@/lib/inference-config";
import { generationConfigured } from "@/lib/generation-config";
import { generations, sourceVersions } from "@/lib/db";
import { sourceMetadata } from "@/lib/source-metadata";
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
    versions: sourceVersions.list(auth.owner!, id).map(sourceMetadata),
    configured: generationConfigured(),
    model: inferenceConfig().model,
    provider: inferenceConfig().provider,
  });
}
