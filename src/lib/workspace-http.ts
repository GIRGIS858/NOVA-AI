import "server-only";
import { json } from "./generation-http";
import { WorkspaceError } from "./project-workspace";
export function workspaceError(error: unknown) {
  if (!(error instanceof WorkspaceError))
    return json({ error: "workspace_failed" }, 500);
  const status =
    error.code === "unavailable"
      ? 404
      : error.code === "invalid_request"
        ? 400
        : ["conflict", "source_limit", "unchanged"].includes(error.code)
          ? 409
          : 422;
  return json({ error: error.code }, status);
}
