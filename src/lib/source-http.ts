import "server-only";
import { json } from "./generation-http";
import { SourceOperationError } from "./static-source";
export function sourceError(error: unknown) {
  if (!(error instanceof SourceOperationError))
    return json({ error: "source_failed" }, 500);
  const status =
    error.code === "unavailable"
      ? 404
      : error.code === "invalid_request"
        ? 400
        : error.code === "conflict" || error.code === "source_limit"
          ? 409
          : 422;
  return json({ error: error.code }, status);
}
