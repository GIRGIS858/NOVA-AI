import { db } from "@/lib/db";
import {
  projectWorkspaceStore,
  WORKSPACE_REQUEST_BYTES,
} from "@/lib/project-workspace";
import {
  authorizeProject,
  json,
  smallJson,
  validOrigin,
} from "@/lib/generation-http";
import { workspaceError } from "@/lib/workspace-http";
export const runtime = "nodejs";
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const auth = await authorizeProject(id);
  if (auth.response) return auth.response;
  const params = new URL(request.url).searchParams;
  if (params.getAll("version").length > 1)
    return json({ error: "invalid_request" }, 400);
  try {
    return json(
      projectWorkspaceStore(db).read(
        auth.owner!,
        id,
        params.get("version") ?? undefined,
      ),
    );
  } catch (error) {
    return workspaceError(error);
  }
}
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
    input = await smallJson(request, WORKSPACE_REQUEST_BYTES);
  } catch {
    return json({ error: "invalid_request" }, 400);
  }
  try {
    return json(
      { version: projectWorkspaceStore(db).save(auth.owner!, id, input) },
      201,
    );
  } catch (error) {
    return workspaceError(error);
  }
}
