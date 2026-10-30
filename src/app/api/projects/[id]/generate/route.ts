import { generationConfigured } from "@/lib/generation-config";
import { z } from "zod";
import { generationJobs } from "@/lib/db";
import { inferenceConfig } from "@/lib/inference-config";
import {
  authorizeProject,
  json,
  smallJson,
  validOrigin,
} from "@/lib/generation-http";
import { ProviderError } from "@/lib/provider-error";
import { GenerationStoreError } from "@/lib/generation-store";
export const runtime = "nodejs";
export const maxDuration = 120;
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
  if (!generationConfigured()) return json({ error: "not_configured" }, 503);
  try {
    const result = generationJobs.enqueue(
      auth.owner!,
      id,
      input.requestId,
      inferenceConfig(),
    );
    const run = generationJobs
      .runs(auth.owner!, id)
      .find((run) => run.id === result.run.id);
    return json({ run: run || result.run }, result.existing ? 200 : 202);
  } catch (error) {
    if (error instanceof ProviderError) return json({ error: error.code }, 422);
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
