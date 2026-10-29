import { NextResponse } from "next/server";
import { session } from "@/lib/auth";
import { projects, generationRuns, sourceVersions } from "@/lib/db";
import { freeModelConfig, AIProviderError } from "@/lib/ai-provider";
import { GenerationRunError } from "@/lib/generation-runs";
import { executeGeneration, cancelGeneration } from "@/lib/generation";
import { staticPreview } from "@/lib/static-preview";
import { ZodError } from "zod";
export const runtime = "nodejs";
export const maxDuration = 120;
type Context = { params: Promise<{ id: string }> };
const json = (data: unknown, status = 200) =>
  NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
async function access(context: Context) {
  const user = (await session())?.user;
  const { id } = await context.params;
  return { user, id, allowed: user && Boolean(projects.get(user.id, id)) };
}
function sameOrigin(request: Request) {
  return (
    request.headers.get("origin") ===
    new URL(process.env.BETTER_AUTH_URL || "http://localhost:3000").origin
  );
}
async function body(request: Request) {
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    throw new Error("Invalid body");
  if (!request.body) throw new Error("Invalid body");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    while (true) {
      const r = await reader.read();
      if (r.done) break;
      bytes += r.value.byteLength;
      if (bytes > 40000) {
        await reader.cancel();
        throw new Error("Invalid body");
      }
      chunks.push(r.value);
    }
  } finally {
    reader.releaseLock();
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}
export async function GET(_request: Request, context: Context) {
  const { user, id, allowed } = await access(context);
  if (!user) return json({ error: "UNAUTHORIZED" }, 401);
  if (!allowed) return json({ error: "NOT_FOUND" }, 404);
  const version = sourceVersions.latest(user.id, id);
  const html = version?.files.find((f) => f.path === "index.html");
  return json({
    config: freeModelConfig(),
    runs: generationRuns.list(user.id, id),
    version,
    preview: html ? staticPreview(html.content) : null,
  });
}
export async function POST(request: Request, context: Context) {
  if (!sameOrigin(request)) return json({ error: "FORBIDDEN" }, 403);
  const { user, id, allowed } = await access(context);
  if (!user) return json({ error: "UNAUTHORIZED" }, 401);
  if (!allowed) return json({ error: "NOT_FOUND" }, 404);
  let input: unknown;
  try {
    input = await body(request);
  } catch {
    return json({ error: "INVALID_INPUT" }, 400);
  }
  try {
    return json({
      run: await executeGeneration(user.id, id, input, request.signal),
    });
  } catch (error) {
    if (error instanceof AIProviderError)
      return json({ error: error.code }, 503);
    if (error instanceof ZodError) return json({ error: "INVALID_INPUT" }, 400);
    if (error instanceof GenerationRunError)
      return json(
        { error: error.code },
        error.code === "NOT_FOUND" ? 404 : 409,
      );
    return json({ error: "GENERATION_FAILED" }, 500);
  }
}
export async function DELETE(request: Request, context: Context) {
  if (!sameOrigin(request)) return json({ error: "FORBIDDEN" }, 403);
  const { user, id, allowed } = await access(context);
  if (!user) return json({ error: "UNAUTHORIZED" }, 401);
  if (!allowed) return json({ error: "NOT_FOUND" }, 404);
  let input;
  try {
    input = await body(request);
    if (typeof input.runId !== "string") throw new Error();
  } catch {
    return json({ error: "INVALID_INPUT" }, 400);
  }
  try {
    return json({ run: cancelGeneration(user.id, id, input.runId) });
  } catch {
    return json({ error: "NOT_FOUND" }, 404);
  }
}
