"use client";

import { useEffect, useRef, useState } from "react";
import { Save, X, Download } from "lucide-react";
import type { sourceMetadata } from "@/lib/source-metadata";
type File = { path: string; content: string };

export function StaticSourceEditor({
  projectId,
  ar,
  baseVersionId,
  initialFiles,
  onSaved,
  onClose,
  errorMessage,
}: {
  projectId: string;
  ar: boolean;
  baseVersionId: string | null;
  initialFiles: File[];
  onSaved: (version: ReturnType<typeof sourceMetadata>) => void;
  onClose: () => void;
  errorMessage: (code: string) => string;
}) {
  const [files, setFiles] = useState(initialFiles);
  const [path, setPath] = useState("index.html");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const inFlight = useRef(false);
  const dirty = JSON.stringify(files) !== JSON.stringify(initialFiles);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  async function save() {
    if (inFlight.current) return;
    inFlight.current = true;
    setSaving(true);
    setError("");
    try {
      const response = await fetch(
        `/api/projects/${encodeURIComponent(projectId)}/source`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ baseVersionId, files }),
        },
      );
      const data = await response.json();
      if (!response.ok)
        throw new Error(
          typeof data.error === "string" ? data.error : "source_failed",
        );
      onSaved(data.version);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "source_failed");
    } finally {
      inFlight.current = false;
      setSaving(false);
    }
  }
  function close() {
    if (
      dirty &&
      !window.confirm(
        ar
          ? "تجاهل تعديلات المسودة غير المحفوظة؟"
          : "Discard unsaved draft changes?",
      )
    )
      return;
    onClose();
  }
  function downloadDraft() {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify({ baseVersionId, files }, null, 2)], {
        type: "application/json",
      }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "nova-source-draft.json";
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <section className="static-editor" aria-labelledby="static-editor-title">
      <h4 id="static-editor-title">
        {ar ? "تحرير ملفات الموقع" : "Edit website files"}
      </h4>
      <p className="generation-description">
        {ar
          ? "تعديل يدوي بدون AI. يحفظ زر الحفظ إصدارًا جديدًا ثم يحدّث المعاينة. المسودة غير المحفوظة تبقى في هذه الصفحة فقط."
          : "Manual editing without AI. Save creates a new version and updates the preview. Unsaved drafts stay on this page only."}
      </p>
      <div className="generation-source">
        <div
          className="generation-file-tabs"
          aria-label={ar ? "ملفات المسودة" : "Draft files"}
        >
          {files.map((file) => (
            <button
              key={file.path}
              type="button"
              aria-pressed={path === file.path}
              onClick={() => setPath(file.path)}
            >
              {file.path}
            </button>
          ))}
        </div>
        <label className="static-editor-label" htmlFor="static-source-content">
          {ar ? "تعديل" : "Edit"} {path}
        </label>
        <textarea
          id="static-source-content"
          dir="ltr"
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          disabled={saving}
          value={files.find((file) => file.path === path)?.content || ""}
          onChange={(event) =>
            setFiles((current) =>
              current.map((file) =>
                file.path === path
                  ? { ...file, content: event.target.value }
                  : file,
              ),
            )
          }
        />
      </div>
      {error && (
        <div role="alert" className="form-error">
          <p>{errorMessage(error)}</p>
          {error === "conflict" && (
            <p>
              {ar
                ? "مسودتك محفوظة هنا. نزّلها أو انسخها قبل فتح النسخة الأحدث؛ لم نستبدل أي ملفات."
                : "Your draft remains here. Download or copy it before opening the latest version; no files were overwritten."}
            </p>
          )}
        </div>
      )}
      <div className="generation-actions">
        <button
          className="button primary small"
          type="button"
          disabled={saving || !dirty}
          onClick={() => void save()}
        >
          <Save size={14} aria-hidden="true" />
          {saving
            ? ar
              ? "جارٍ الحفظ…"
              : "Saving…"
            : ar
              ? "احفظ إصدارًا جديدًا"
              : "Save a new version"}
        </button>
        <button
          className="button ghost small"
          type="button"
          onClick={downloadDraft}
        >
          <Download size={14} aria-hidden="true" />
          {ar ? "نزّل المسودة" : "Download draft"}
        </button>
        <button
          className="button ghost small"
          type="button"
          disabled={saving}
          onClick={close}
        >
          <X size={14} aria-hidden="true" />
          {ar ? "أغلق المحرّر" : "Close editor"}
        </button>
      </div>
    </section>
  );
}
