import { sourceVersions } from "@/lib/db";
import { SourceVersionError } from "@/lib/versions";
import { sourceMetadata } from "@/lib/source-metadata";
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
  try {
    const version = sourceVersions.get(auth.owner!, id, versionId);
    const files = validateFiles(version.files);
    return json({
      version: { ...sourceMetadata(version), files },
      preview: buildPreview(files),
    });
  } catch (error) {
    if (error instanceof SourceVersionError && error.code === "NOT_FOUND")
      return json({ error: "unavailable" }, 404);
    return json({ error: "invalid_output" }, 422);
  }
}
