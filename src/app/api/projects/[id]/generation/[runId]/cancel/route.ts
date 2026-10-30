import { generations, generationJobs } from "@/lib/db";
import { authorizeProject, json, validOrigin } from "@/lib/generation-http";
export const runtime = "nodejs";
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string; runId: string }> },
) {
  if (!validOrigin(request)) return json({ error: "forbidden" }, 403);
  const { id, runId } = await context.params;
  const auth = await authorizeProject(id);
  if (auth.response) return auth.response;
  const run = generations.getRun(auth.owner!, runId);
  if (!run || run.project_id !== id) return json({ error: "unavailable" }, 404);
  generationJobs.cancel(auth.owner!, id, runId);
  return json({ run: generations.getRun(auth.owner!, runId) });
}
