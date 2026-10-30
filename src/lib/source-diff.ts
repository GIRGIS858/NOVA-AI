export type DiffLine = { kind: "same" | "added" | "removed"; text: string };

// Retain line endings so whitespace-only changes remain visible and reconstructable.
function lines(text: string): string[] {
  return text.match(/[^\n]*\n|[^\n]+$/g) || [];
}

export function sourceDiff(
  before: string,
  after: string,
): {
  lines: DiffLine[];
  coarse: boolean;
} {
  const a = lines(before),
    b = lines(after);
  let prefix = 0,
    suffix = 0;
  while (prefix < a.length && prefix < b.length && a[prefix] === b[prefix])
    prefix++;
  while (
    suffix < a.length - prefix &&
    suffix < b.length - prefix &&
    a[a.length - 1 - suffix] === b[b.length - 1 - suffix]
  )
    suffix++;
  const old = a.slice(prefix, a.length - suffix);
  const next = b.slice(prefix, b.length - suffix);
  const result: DiffLine[] = a
    .slice(0, prefix)
    .map((text) => ({ kind: "same", text }));
  // Bound quadratic work on untrusted source; large replacements remain exact,
  // but may include unchanged interior lines in the removed/added blocks.
  const coarse = (old.length + 1) * (next.length + 1) > 250_000;
  if (coarse) {
    for (const text of old) result.push({ kind: "removed", text });
    for (const text of next) result.push({ kind: "added", text });
  } else {
    const width = next.length + 1;
    const table = new Uint32Array((old.length + 1) * width);
    for (let i = old.length - 1; i >= 0; i--) {
      for (let j = next.length - 1; j >= 0; j--) {
        table[i * width + j] =
          old[i] === next[j]
            ? 1 + table[(i + 1) * width + j + 1]
            : Math.max(table[(i + 1) * width + j], table[i * width + j + 1]);
      }
    }
    let i = 0,
      j = 0;
    while (i < old.length || j < next.length) {
      if (i < old.length && j < next.length && old[i] === next[j]) {
        result.push({ kind: "same", text: old[i++] });
        j++;
      } else if (
        i < old.length &&
        (j === next.length ||
          table[(i + 1) * width + j] >= table[i * width + j + 1])
      ) {
        result.push({ kind: "removed", text: old[i++] });
      } else {
        result.push({ kind: "added", text: next[j++] });
      }
    }
  }
  for (const text of a.slice(a.length - suffix))
    result.push({ kind: "same", text });
  return { lines: result, coarse };
}
