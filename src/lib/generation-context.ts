import { z } from "zod";
import { validateFiles, type SourceFile } from "./static-artifact";
import { ProviderError } from "./provider-error";

export const MAX_PROMPT_CHARS = 16000;
// Measured after JSON encoding, including requirements, metadata and whole files.
export const MAX_CONTEXT_BYTES = 256 * 1024;
export type SourceContext = { versionId: string | null; files: SourceFile[] };
const sourceSchema = z
  .object({
    versionId: z.uuid().nullable(),
    files: z
      .array(z.object({ path: z.string(), content: z.string() }).strict())
      .max(2),
  })
  .strict();

/** Preserve complete source. If it cannot fit, reject instead of editing a fragment. */
export function generationContext(
  prompt: string,
  source: SourceContext = { versionId: null, files: [] },
) {
  if (!prompt.trim()) throw new ProviderError("invalid_output");
  if (prompt.length > MAX_PROMPT_CHARS)
    throw new ProviderError("context_limit");
  const parsed = sourceSchema.safeParse(source);
  if (
    !parsed.success ||
    (parsed.data.files.length > 0 && !parsed.data.versionId)
  )
    throw new ProviderError("unsupported_source");
  let files: SourceFile[] = [];
  if (parsed.data.files.length) {
    try {
      files = validateFiles(parsed.data.files);
    } catch {
      throw new ProviderError("unsupported_source");
    }
  }
  const content = JSON.stringify({
    mode: files.length ? "edit" : "create",
    requirements: prompt,
    source: { versionId: parsed.data.versionId, files },
  });
  if (Buffer.byteLength(content, "utf8") > MAX_CONTEXT_BYTES)
    throw new ProviderError("context_limit");
  return content;
}

/** Retain newest note content without starting halfway through a UTF-16 pair. */
export function latestNotesWithinBudget(notes: string, maxChars: number) {
  if (maxChars <= 0) return "";
  const start = Math.max(0, notes.length - maxChars);
  const first = notes.charCodeAt(start);
  const previous = notes.charCodeAt(start - 1);
  return notes.slice(
    start > 0 &&
      first >= 0xdc00 &&
      first <= 0xdfff &&
      previous >= 0xd800 &&
      previous <= 0xdbff
      ? start + 1
      : start,
  );
}
