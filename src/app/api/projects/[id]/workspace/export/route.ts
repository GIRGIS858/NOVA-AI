import { db } from "@/lib/db";
import { projectWorkspaceStore } from "@/lib/project-workspace";
import { authorizeProject, json } from "@/lib/generation-http";
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
  if (params.getAll("version").length !== 1)
    return json({ error: "invalid_request" }, 400);
  try {
    const { version, archive } = projectWorkspaceStore(db).export(
      auth.owner!,
      id,
      params.get("version")!,
    );
    return new Response(new Uint8Array(archive), {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="nova-source-${version.id}.zip"`,
        "Content-Length": String(archive.byteLength),
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return workspaceError(error);
  }
}
