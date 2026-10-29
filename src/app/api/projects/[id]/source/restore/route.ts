import { staticSources } from "@/lib/db";
import {
  authorizeProject,
  json,
  smallJson,
  validOrigin,
} from "@/lib/generation-http";
import { sourceError } from "@/lib/source-http";
import { sourceMetadata } from "@/lib/source-metadata";
export const runtime = "nodejs";
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  if (!validOrigin(request)) return json({ error: "forbidden" }, 403);
  const { id } = await context.params;
  const auth = await authorizeProject(id);
  if (auth.response) return auth.response;
  let input: unknown;
  try {
    input = await smallJson(request);
  } catch {
    return json({ error: "invalid_request" }, 400);
  }
  try {
    return json(
      {
        version: sourceMetadata(staticSources.restore(auth.owner!, id, input)),
      },
      201,
    );
  } catch (error) {
    return sourceError(error);
  }
}
