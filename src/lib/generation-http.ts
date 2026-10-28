import "server-only";
import { session } from "./auth";
import { projects } from "./db";

export function json(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
export async function authorizeProject(projectId: string) {
  const current = await session();
  if (!current) return { response: json({ error: "unauthorized" }, 401) };
  if (!projects.get(current.user.id, projectId))
    return { response: json({ error: "unavailable" }, 404) };
  return { owner: current.user.id };
}
export function validOrigin(request: Request) {
  try {
    const expected = new URL(
      process.env.BETTER_AUTH_URL || "http://localhost:3000",
    ).origin;
    return (
      request.headers.get("origin") === expected &&
      request.headers.get("sec-fetch-site") !== "cross-site"
    );
  } catch {
    return false;
  }
}
export async function smallJson(request: Request): Promise<unknown> {
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    throw new Error("invalid_request");
  const reader = request.body?.getReader();
  if (!reader) throw new Error("invalid_request");
  let total = 0;
  const chunks: Uint8Array[] = [];
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > 1024) {
        await reader.cancel();
        throw new Error("invalid_request");
      }
      chunks.push(value);
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } finally {
    reader.releaseLock();
  }
}
