import { generations } from "@/lib/db";
import { authorizeProject, json } from "@/lib/generation-http";
import { buildPreview, validateFiles } from "@/lib/static-artifact";
export const runtime = "nodejs";
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string; versionId: string }> },
) {
  const { id, versionId } = await context.params;
  const auth = await authorizeProject(id);
  if (auth.response) return auth.response;
  const version = generations.version(auth.owner!, id, versionId);
  if (!version) return json({ error: "unavailable" }, 404);
  try {
    const files = validateFiles(JSON.parse(version.files_json));
    return json({
      version: { id: version.id, created_at: version.created_at, files },
      preview: buildPreview(files),
    });
  } catch {
    return json({ error: "invalid_output" }, 422);
  }
}
