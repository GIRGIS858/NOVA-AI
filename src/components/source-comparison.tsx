"use client";

import { useEffect, useMemo, useState } from "react";
import { sourceDiff } from "../lib/source-diff";

type File = { path: string; content: string };
type Version = { id: string; number: number };

export function SourceComparison({
  projectId,
  selected,
  files,
  versions,
  ar,
}: {
  projectId: string;
  selected: string;
  files: File[];
  versions: Version[];
  ar: boolean;
}) {
  const candidates = versions.filter((v) => v.id !== selected);
  const index = versions.findIndex((v) => v.id === selected);
  const [baseline, setBaseline] = useState(
    versions[index + 1]?.id || candidates[0]?.id || "",
  );
  const [loaded, setLoaded] = useState<{ id: string; files: File[] } | null>(
    null,
  );
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!baseline) return;
    const controller = new AbortController();
    setLoaded(null);
    setFailed(false);
    void fetch(
      `/api/projects/${encodeURIComponent(projectId)}/versions/${encodeURIComponent(baseline)}`,
      { cache: "no-store", signal: controller.signal },
    )
      .then(async (response) => {
        if (!response.ok) throw new Error("unavailable");
        return response.json();
      })
      .then((data) => {
        if (!controller.signal.aborted)
          setLoaded({ id: baseline, files: data.version.files });
      })
      .catch(() => {
        if (!controller.signal.aborted) setFailed(true);
      });
    return () => controller.abort();
  }, [projectId, baseline, retry]);
  const comparisons = useMemo(() => {
    if (!loaded || loaded.id !== baseline) return [];
    return [...new Set([...loaded.files, ...files].map((f) => f.path))]
      .sort()
      .map((path) => {
        const before = loaded.files.find((f) => f.path === path);
        const after = files.find((f) => f.path === path);
        return {
          path,
          changed: before?.content !== after?.content,
          ...sourceDiff(before?.content || "", after?.content || ""),
        };
      });
  }, [loaded, baseline, files]);
  if (!candidates.length)
    return (
      <p role="status">
        {ar
          ? "احفظ إصدارًا آخر لعرض المقارنة."
          : "Save another version to compare changes."}
      </p>
    );
  return (
    <section
      className="source-comparison"
      aria-label={ar ? "مقارنة الإصدارات" : "Version comparison"}
    >
      <label htmlFor="comparison-base">
        {ar ? "قارن من الإصدار" : "Compare from version"}
        <select
          id="comparison-base"
          value={baseline}
          onChange={(event) => setBaseline(event.target.value)}
        >
          {candidates.map((v) => (
            <option key={v.id} value={v.id}>
              {ar ? "نسخة" : "Version"} {v.number}
            </option>
          ))}
        </select>
      </label>
      <p className="generation-preview-note">
        {ar ? "إلى الإصدار المحدد" : "To selected version"}{" "}
        {versions.find((v) => v.id === selected)?.number} ·{" "}
        {ar ? "+ إضافة · − حذف" : "+ added · − removed"}
      </p>
      {failed ? (
        <div>
          <p role="alert">
            {ar ? "تعذّر تحميل المقارنة." : "Could not load comparison."}
          </p>
          <button
            className="button ghost small"
            onClick={() => setRetry((v) => v + 1)}
          >
            {ar ? "أعد المحاولة" : "Retry comparison"}
          </button>
        </div>
      ) : !loaded || loaded.id !== baseline ? (
        <p role="status">
          {ar ? "جارٍ تحميل المقارنة…" : "Loading comparison…"}
        </p>
      ) : (
        comparisons.map((file) => (
          <div key={file.path} className="generation-source comparison-file">
            <h4 dir="ltr">{file.path}</h4>
            {!file.changed ? (
              <p>{ar ? "لا تغييرات" : "No changes"}</p>
            ) : (
              <>
                {file.coarse && (
                  <p>
                    {ar
                      ? "التغيير كبير؛ يُعرض ككتلة استبدال كاملة."
                      : "Large change shown as a full replacement block."}
                  </p>
                )}
                {file.lines.length > 2000 && (
                  <p role="status">
                    {ar
                      ? "تظهر أول ٢٠٠٠ سطر فقط. راجع الملفات الكاملة في عرض الملفات أو تنزيل JSON."
                      : "Showing the first 2,000 lines only. Review complete files in Source or Download JSON."}
                  </p>
                )}
                <pre
                  dir="ltr"
                  tabIndex={0}
                  aria-label={`${ar ? "تغييرات" : "Changes in"} ${file.path}`}
                >
                  <code>
                    {file.lines.slice(0, 2000).map((line, i) => (
                      <span key={i} className={`diff-line diff-${line.kind}`}>
                        <span>
                          {line.kind === "added"
                            ? "+ "
                            : line.kind === "removed"
                              ? "− "
                              : "  "}
                        </span>
                        {line.text.endsWith("\n")
                          ? line.text.slice(0, -1)
                          : line.text}
                        <span className="diff-eol">
                          {!line.text.endsWith("\n")
                            ? ar
                              ? " [دون سطر جديد]"
                              : " [no final newline]"
                            : ""}
                        </span>
                        {"\n"}
                      </span>
                    ))}
                  </code>
                </pre>
              </>
            )}
          </div>
        ))
      )}
    </section>
  );
}
