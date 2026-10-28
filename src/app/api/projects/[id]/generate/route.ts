import { z } from "zod";
import { generations, projects } from "@/lib/db";
import {
  authorizeProject,
  json,
  smallJson,
  validOrigin,
} from "@/lib/generation-http";
import { generateStaticSite } from "@/lib/ai-provider";
import { runGeneration } from "@/lib/run-generation";
import { GenerationStoreError } from "@/lib/generation-store";
export const runtime = "nodejs";
export const maxDuration = 90;
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  if (!validOrigin(request)) return json({ error: "forbidden" }, 403);
  const { id } = await context.params;
  const auth = await authorizeProject(id);
  if (auth.response) return auth.response;
  let input: { requestId: string };
  try {
    input = z
      .object({ requestId: z.string().uuid() })
      .strict()
      .parse(await smallJson(request));
  } catch {
    return json({ error: "invalid_request" }, 400);
  }
  const apiKey = process.env.NOVA_AI_API_KEY;
  if (!apiKey) return json({ error: "not_configured" }, 503);
  try {
    const result = await runGeneration(
      {
        owner: auth.owner!,
        projectId: id,
        requestId: input.requestId,
        signal: request.signal,
        apiKey,
      },
      { generations, projects, provider: generateStaticSite },
    );
    return json(result);
  } catch (error) {
    if (error instanceof GenerationStoreError)
      return json(
        { error: error.code },
        error.code === "unavailable"
          ? 404
          : error.code === "invalid_request"
            ? 400
            : 409,
      );
    return json({ error: "provider_error" }, 502);
  }
}
