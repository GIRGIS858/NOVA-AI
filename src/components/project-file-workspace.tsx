"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Code2,
  Download,
  FileCode2,
  FilePlus2,
  Folder,
  LoaderCircle,
  Pencil,
  RefreshCw,
  RotateCcw,
  Save,
  Trash2,
  X,
} from "lucide-react";

type SourceFile = { path: string; content: string };
type VersionInfo = {
  id: string;
  number: number;
  createdAt: string;
  restoredFrom: string | null;
  summary: string;
  fileCount: number;
  totalBytes: number;
};
type SourceVersion = VersionInfo & { files: SourceFile[] };
type WorkspaceData = {
  version: SourceVersion | null;
  versions: VersionInfo[];
  latestVersionId: string | null;
  limits: {
    files: number;
    fileBytes: number;
    totalBytes: number;
    versions: number;
  };
};
type TreeNode = {
  name: string;
  path: string;
  file?: SourceFile;
  children: Map<string, TreeNode>;
};
const defaultLimits = {
  files: 200,
  fileBytes: 262144,
  totalBytes: 2097152,
  versions: 128,
};
const ordered = (files: SourceFile[]) =>
  [...files].sort((a, b) => a.path.localeCompare(b.path));
function makeTree(files: SourceFile[]) {
  const root: TreeNode = { name: "", path: "", children: new Map() };
  for (const file of ordered(files)) {
    let node = root;
    for (const part of file.path.split("/")) {
      const path = node.path ? `${node.path}/${part}` : part;
      if (!node.children.has(part))
        node.children.set(part, { name: part, path, children: new Map() });
      node = node.children.get(part)!;
    }
    node.file = file;
  }
  return root;
}
function FileTree({
  node,
  selected,
  onSelect,
  changed,
  ar,
}: {
  node: TreeNode;
  selected: string;
  onSelect: (path: string) => void;
  changed: Set<string>;
  ar: boolean;
}) {
  return (
    <ul>
      {[...node.children.values()]
        .sort(
          (a, b) =>
            Number(Boolean(a.file)) - Number(Boolean(b.file)) ||
            a.name.localeCompare(b.name),
        )
        .map((child) => (
          <li key={child.path}>
            {child.file ? (
              <button
                type="button"
                aria-label={`${ar ? "افتح" : "Open"} ${child.path}`}
                aria-pressed={selected === child.path}
                onClick={() => onSelect(child.path)}
                title={child.path}
              >
                <FileCode2 size={14} aria-hidden="true" />
                <span>{child.name}</span>
                {changed.has(child.path) && (
                  <span
                    className="file-workspace-dot"
                    aria-label={ar ? "معدّل" : "Modified"}
                  >
                    ●
                  </span>
                )}
              </button>
            ) : (
              <details open>
                <summary>
                  <Folder size={14} aria-hidden="true" />
                  <span>{child.name}</span>
                </summary>
                <FileTree
                  node={child}
                  selected={selected}
                  onSelect={onSelect}
                  changed={changed}
                  ar={ar}
                />
              </details>
            )}
          </li>
        ))}
    </ul>
  );
}

function errorMessage(code: string, ar: boolean) {
  if (code === "conflict")
    return ar
      ? "تغيّر الإصدار على الخادم. مسودتك محفوظة هنا ولم نغيّر أساسها. نزّل المسودة قبل فتح الإصدار الأحدث."
      : "The saved version changed on the server. Your draft and its original base are preserved here. Download your draft before opening the latest version.";
  if (["unavailable", "not_found"].includes(code))
    return ar
      ? "هذا المشروع أو الإصدار غير متاح لحسابك."
      : "This project or version is unavailable to your account.";
  if (code === "unauthorized")
    return ar
      ? "انتهت الجلسة. نزّل مسودتك ثم سجّل الدخول مجددًا."
      : "Your session expired. Download your draft, then sign in again.";
  if (code === "forbidden")
    return ar
      ? "تعذّر التحقق من الطلب. نزّل مسودتك قبل إعادة تحميل الصفحة."
      : "The request could not be verified. Download your draft before reloading the page.";
  if (["source_limit", "limit", "LIMIT"].includes(code))
    return ar
      ? "تجاوزت الملفات أو التعديلات أو سجل الإصدارات الحد المسموح. قلّل الحجم أو عدد التعديلات وحاول مجددًا."
      : "The files, changes or version history exceed the supported limit. Reduce size or the number of changes and try again.";
  if (
    [
      "invalid_path",
      "invalid_change",
      "invalid_output",
      "invalid_request",
      "INVALID_PATH",
      "INVALID_CHANGE",
    ].includes(code)
  )
    return ar
      ? "تحقّق من مسارات الملفات وأحجامها. استخدم ملفات نصية ومسارات نسبية، دون أسرار أو مجلدات محجوزة أو أسماء متعارضة."
      : "Check file paths and sizes. Use text files and relative paths, without secrets, reserved folders or conflicting names.";
  if (code === "duplicate_path")
    return ar
      ? "هذا المسار مستخدم أو يتعارض مع اسم ملف أو مجلد آخر."
      : "This path is already used or conflicts with another file or folder.";
  if (code === "not_empty")
    return ar
      ? "يمكن إنشاء القالب في مشروع دون إصدارات محفوظة فقط."
      : "The starter template requires a project with no saved versions.";
  if (code === "unchanged")
    return ar
      ? "لا توجد تغييرات لإنشاء إصدار جديد."
      : "There are no changes to save as a new version.";
  return ar
    ? "تعذّرت العملية. مسودتك ما زالت هنا؛ يمكنك تنزيلها والمحاولة مجددًا."
    : "The operation failed. Your draft is still here; download it or try again.";
}
async function readResponse<T>(response: Response): Promise<T> {
  const data = await response.json();
  if (!response.ok)
    throw new Error(
      typeof data.error === "string" ? data.error : "workspace_failed",
    );
  return data as T;
}

export function ProjectFileWorkspace({
  projectId,
  projectName,
  ar,
}: {
  projectId: string;
  projectName: string;
  ar: boolean;
}) {
  const base = `/api/projects/${encodeURIComponent(projectId)}/workspace`;
  const [data, setData] = useState<WorkspaceData | null>(null);
  const [files, setFiles] = useState<SourceFile[]>([]);
  const [selected, setSelected] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState<"saved" | "restored" | "template" | "">(
    "",
  );
  const [pathAction, setPathAction] = useState<"create" | "rename" | null>(
    null,
  );
  const [newPath, setNewPath] = useState("");
  const request = useRef<AbortController | null>(null);
  const mutationInFlight = useRef(false);
  const original = data?.version?.files || [];
  const changed = useMemo(() => {
    const previous = new Map(original.map((file) => [file.path, file.content]));
    const current = new Map(files.map((file) => [file.path, file.content]));
    return new Set(
      [...new Set([...previous.keys(), ...current.keys()])].filter(
        (path) => previous.get(path) !== current.get(path),
      ),
    );
  }, [original, files]);
  const dirty = changed.size > 0;
  const readOnly = Boolean(
    data?.version && data.version.id !== data.latestVersionId,
  );
  const blocked = !data || loading || busy || readOnly;
  const limits = data?.limits || defaultLimits;
  const file = files.find((item) => item.path === selected);
  const tree = useMemo(() => makeTree(files), [files]);
  const totalBytes = useMemo(
    () =>
      files.reduce(
        (sum, item) => sum + new TextEncoder().encode(item.content).byteLength,
        0,
      ),
    [files],
  );

  const load = useCallback(
    async (versionId?: string) => {
      if (mutationInFlight.current) return;
      request.current?.abort();
      const controller = new AbortController();
      request.current = controller;
      setLoading(true);
      setError("");
      setNotice("");
      try {
        const next = await readResponse<WorkspaceData>(
          await fetch(
            `${base}${versionId ? `?version=${encodeURIComponent(versionId)}` : ""}`,
            { cache: "no-store", signal: controller.signal },
          ),
        );
        if (controller.signal.aborted) return;
        setData(next);
        setFiles(next.version?.files || []);
        setSelected((path) =>
          next.version?.files.some((item) => item.path === path)
            ? path
            : next.version?.files[0]?.path || "",
        );
        setPathAction(null);
      } catch (reason) {
        if (!controller.signal.aborted)
          setError(
            reason instanceof Error ? reason.message : "workspace_failed",
          );
      } finally {
        if (request.current === controller && !controller.signal.aborted) {
          request.current = null;
          setLoading(false);
        }
      }
    },
    [base],
  );
  useEffect(() => {
    void load();
    return () => request.current?.abort();
  }, [load]);
  useEffect(() => {
    if (!dirty) return;
    const warning = ar
      ? "تجاهل تعديلات الملفات غير المحفوظة؟"
      : "Discard unsaved file changes?";
    const unload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    const navigate = (event: MouseEvent) => {
      if (
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      )
        return;
      const target =
        event.target instanceof Element
          ? event.target.closest("a[href]")
          : null;
      if (
        !(target instanceof HTMLAnchorElement) ||
        target.hasAttribute("download") ||
        target.target === "_blank"
      )
        return;
      const next = new URL(target.href, window.location.href);
      if (
        next.pathname === window.location.pathname &&
        next.search === window.location.search
      )
        return;
      if (!window.confirm(warning)) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", unload);
    document.addEventListener("click", navigate, true);
    return () => {
      window.removeEventListener("beforeunload", unload);
      document.removeEventListener("click", navigate, true);
    };
  }, [dirty, ar]);

  function confirmDiscard() {
    return (
      !dirty ||
      window.confirm(
        ar
          ? "تجاهل تعديلات الملفات غير المحفوظة؟ نزّل المسودة أولًا إذا أردت الاحتفاظ بها."
          : "Discard unsaved file changes? Download your draft first if you want to keep it.",
      )
    );
  }
  function showVersion(id?: string) {
    if (!mutationInFlight.current && confirmDiscard()) void load(id);
  }
  function applyVersion(
    version: SourceVersion,
    result: "saved" | "restored" | "template",
  ) {
    const { files: snapshotFiles, ...metadata } = version;
    setData((current) => ({
      version,
      latestVersionId: version.id,
      versions: [
        metadata,
        ...(current?.versions || []).filter((item) => item.id !== version.id),
      ],
      limits: current?.limits || defaultLimits,
    }));
    setFiles(snapshotFiles);
    setSelected((path) =>
      version.files.some((item) => item.path === path)
        ? path
        : version.files[0]?.path || "",
    );
    setPathAction(null);
    setNotice(result);
    setError("");
  }
  async function mutate(
    path: string,
    body: unknown,
    result: "saved" | "restored" | "template",
  ) {
    if (!data || mutationInFlight.current || request.current) return;
    mutationInFlight.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await readResponse<{ version: SourceVersion }>(
        await fetch(`${base}${path}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }),
      );
      applyVersion(response.version, result);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "workspace_failed");
    } finally {
      mutationInFlight.current = false;
      setBusy(false);
    }
  }
  function save() {
    if (blocked || !dirty) return;
    void mutate(
      "",
      { baseVersionId: data?.version?.id || null, files },
      "saved",
    );
  }
  function restore() {
    if (busy || loading || !data?.version || !readOnly || !confirmDiscard())
      return;
    if (
      !window.confirm(
        ar
          ? "استعادة هذه الملفات كإصدار جديد؟ سيبقى السجل السابق محفوظًا."
          : "Restore these files as a new version? Earlier history will remain saved.",
      )
    )
      return;
    void mutate(
      "/restore",
      { baseVersionId: data.latestVersionId, versionId: data.version.id },
      "restored",
    );
  }
  function createTemplate() {
    if (busy || loading || data?.latestVersionId || !confirmDiscard()) return;
    void mutate("/template", { baseVersionId: null }, "template");
  }
  function submitPath(event: React.FormEvent) {
    event.preventDefault();
    if (blocked) return;
    const path = newPath.trim();
    if (
      !path ||
      path.length > 240 ||
      path.startsWith("/") ||
      path.split("/").some((part) => !part || part === "." || part === "..")
    ) {
      setError("invalid_path");
      return;
    }
    const existing = files.filter(
      (item) => pathAction !== "rename" || item.path !== selected,
    );
    const lower = path.toLowerCase();
    if (
      existing.some((item) => {
        const other = item.path.toLowerCase();
        return (
          other === lower ||
          other.startsWith(`${lower}/`) ||
          lower.startsWith(`${other}/`)
        );
      })
    ) {
      setError("duplicate_path");
      return;
    }
    if (pathAction === "create") {
      if (files.length >= limits.files) {
        setError("source_limit");
        return;
      }
      setFiles((current) => ordered([...current, { path, content: "" }]));
    } else {
      setFiles((current) =>
        ordered(
          current.map((item) =>
            item.path === selected ? { ...item, path } : item,
          ),
        ),
      );
    }
    setSelected(path);
    setPathAction(null);
    setError("");
    setNotice("");
  }
  function removeFile() {
    if (
      blocked ||
      !file ||
      !window.confirm(
        ar
          ? `حذف ${file.path} من المسودة؟ يُحفظ الحذف عند حفظ إصدار جديد.`
          : `Delete ${file.path} from the draft? The deletion is committed when you save a version.`,
      )
    )
      return;
    const next = files.filter((item) => item.path !== selected);
    setFiles(next);
    setSelected(next[0]?.path || "");
    setNotice("");
  }
  function downloadDraft() {
    const url = URL.createObjectURL(
      new Blob(
        [
          JSON.stringify(
            { baseVersionId: data?.version?.id || null, files },
            null,
            2,
          ),
        ],
        { type: "application/json" },
      ),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `nova-project-${projectId}-draft.json`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const date = (value: string) =>
    new Intl.DateTimeFormat(ar ? "ar" : "en", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date(value));
  return (
    <main className="file-workspace" aria-labelledby="file-workspace-title">
      <div className="file-workspace-heading">
        <div>
          <Link
            href={`/app/projects/${projectId}`}
            className="file-workspace-back"
          >
            <ArrowLeft size={15} aria-hidden="true" />
            {ar ? "العودة للمشروع" : "Back to project"}
          </Link>
          <p className="overline">{projectName}</p>
          <h1 id="file-workspace-title">
            {ar ? "ملفات المشروع" : "Project files"}
          </h1>
        </div>
        <span className="file-workspace-badge">
          <Code2 size={15} aria-hidden="true" />
          {ar ? "مساحة المصدر" : "Source workspace"}
        </span>
      </div>
      <p className="file-workspace-description">
        {ar
          ? "حرّر ملفات الواجهة والخادم واحفظ كل تعديل كإصدار مستقل. لا يُنفَّذ الكود هنا؛ تشغيل التطبيقات والمعاينات الكاملة ينتظر بيئة التنفيذ المعزولة."
          : "Edit frontend and server files and save changes as immutable versions. Code is not executed here; application builds and full previews await the isolated execution environment."}
      </p>
      <div className="file-workspace-controls">
        <label htmlFor="workspace-version">
          {ar ? "الإصدار المحفوظ" : "Saved version"}
          <select
            id="workspace-version"
            disabled={!data || busy || loading}
            value={data?.version?.id || ""}
            onChange={(event) => showVersion(event.target.value || undefined)}
          >
            {!data?.versions.length && (
              <option value="">
                {ar ? "لا إصدارات بعد" : "No saved versions"}
              </option>
            )}
            {data?.versions.map((version) => (
              <option key={version.id} value={version.id}>
                {ar ? "إصدار" : "Version"} {version.number} ·{" "}
                {date(version.createdAt)}
                {version.restoredFrom ? (ar ? " · مستعاد" : " · restored") : ""}
              </option>
            ))}
          </select>
        </label>
        <div className="file-workspace-actions">
          <button
            type="button"
            className="button ghost small"
            disabled={loading || busy}
            onClick={() => showVersion()}
          >
            <RefreshCw size={14} aria-hidden="true" />
            {ar ? "افتح الأحدث" : "Open latest"}
          </button>
          <button
            type="button"
            className="button ghost small"
            disabled={loading || busy || !data}
            onClick={downloadDraft}
          >
            <Download size={14} aria-hidden="true" />
            {ar ? "نزّل المسودة JSON" : "Download draft JSON"}
          </button>
          {data?.version && (
            <a
              className="button ghost small"
              href={`${base}/export?version=${encodeURIComponent(data.version.id)}`}
              download
            >
              <Download size={14} aria-hidden="true" />
              {ar ? "نزّل الإصدار ZIP" : "Download saved ZIP"}
            </a>
          )}
          {readOnly ? (
            <button
              type="button"
              className="button primary small"
              disabled={busy || loading}
              onClick={restore}
            >
              <RotateCcw size={14} aria-hidden="true" />
              {ar ? "استعد كإصدار جديد" : "Restore as new version"}
            </button>
          ) : (
            <button
              type="button"
              className="button primary small"
              disabled={blocked || !dirty}
              onClick={save}
            >
              {busy ? (
                <LoaderCircle size={14} className="spin" aria-hidden="true" />
              ) : (
                <Save size={14} aria-hidden="true" />
              )}
              {busy
                ? ar
                  ? "جارٍ الحفظ…"
                  : "Saving…"
                : ar
                  ? "احفظ إصدارًا"
                  : "Save version"}
            </button>
          )}
        </div>
      </div>
      {loading && (
        <p role="status" className="file-workspace-status">
          {ar ? "جارٍ تحميل الملفات…" : "Loading files…"}
        </p>
      )}
      {error && (
        <div className="file-workspace-error" role="alert">
          <p>{errorMessage(error, ar)}</p>
          {!data && (
            <button
              type="button"
              className="button ghost small"
              onClick={() => void load()}
              disabled={loading}
            >
              {ar ? "أعد المحاولة" : "Try again"}
            </button>
          )}
        </div>
      )}
      {notice && (
        <p role="status" className="file-workspace-status">
          {notice === "restored"
            ? ar
              ? "استُعيدت الملفات كإصدار جديد."
              : "Files restored as a new version."
            : notice === "template"
              ? ar
                ? "حُفظ قالب البداية. يمكنك تعديل ملفاته الآن."
                : "Starter template saved. You can edit its files now."
              : ar
                ? "حُفظ إصدار جديد بكل التعديلات."
                : "A new version was saved with all changes."}
        </p>
      )}
      {readOnly && (
        <p className="file-workspace-notice">
          {ar
            ? "تستعرض إصدارًا سابقًا للقراءة. افتح الأحدث للتحرير، أو استعد هذا الإصدار كنسخة جديدة."
            : "You are viewing a historical version. Open the latest to edit, or restore this version as a new snapshot."}
        </p>
      )}
      {!loading && data && !data.latestVersionId && (
        <div className="file-workspace-starter">
          <div>
            <h2>
              {ar
                ? "ابدأ من ملفاتك أو من قالب"
                : "Start with your files or a template"}
            </h2>
            <p>
              {ar
                ? "قالب React وNode يوفر نقطة بداية قابلة للتحرير. حفظ القالب لا يشغّل التطبيق أو ينشره."
                : "The React and Node starter provides editable source. Saving it does not build or publish an application."}
            </p>
          </div>
          <button
            type="button"
            className="button ghost small"
            disabled={busy}
            onClick={createTemplate}
          >
            <Code2 size={15} aria-hidden="true" />
            {ar ? "ابدأ بقالب فل ستاك" : "Start full-stack template"}
          </button>
        </div>
      )}
      <section
        className="file-workspace-grid"
        aria-label={ar ? "محرّر الملفات" : "File editor"}
        aria-busy={loading || busy}
      >
        <aside className="file-workspace-sidebar">
          <div className="file-workspace-sidebar-heading">
            <h2>
              {ar ? "الملفات" : "Files"} <span>{files.length}</span>
            </h2>
            <button
              type="button"
              className="button ghost small"
              disabled={blocked}
              onClick={() => {
                setPathAction("create");
                setNewPath("");
              }}
            >
              <FilePlus2 size={15} aria-hidden="true" />
              {ar ? "ملف جديد" : "New file"}
            </button>
          </div>
          {pathAction && (
            <form className="file-workspace-path-form" onSubmit={submitPath}>
              <label htmlFor="workspace-file-path">
                {ar ? "مسار الملف" : "File path"}
                <input
                  id="workspace-file-path"
                  dir="ltr"
                  autoFocus
                  autoComplete="off"
                  value={newPath}
                  maxLength={240}
                  placeholder="src/App.tsx"
                  onChange={(event) => setNewPath(event.target.value)}
                  disabled={blocked}
                />
              </label>
              <div>
                <button
                  className="button primary small"
                  disabled={blocked}
                  type="submit"
                >
                  {pathAction === "create"
                    ? ar
                      ? "أضف الملف"
                      : "Add file"
                    : ar
                      ? "احفظ الاسم"
                      : "Save name"}
                </button>
                <button
                  type="button"
                  className="button ghost small"
                  onClick={() => setPathAction(null)}
                  aria-label={ar ? "أغلق نموذج المسار" : "Close path form"}
                >
                  <X size={14} aria-hidden="true" />
                </button>
              </div>
            </form>
          )}
          <nav
            className="file-workspace-tree"
            dir="ltr"
            aria-label={ar ? "شجرة ملفات المشروع" : "Project file tree"}
          >
            <FileTree
              node={tree}
              selected={selected}
              onSelect={(path) => {
                setSelected(path);
                setPathAction(null);
              }}
              changed={changed}
              ar={ar}
            />
          </nav>
          {!files.length && (
            <p className="file-workspace-empty-tree">
              {ar ? "لا ملفات في هذه النسخة." : "No files in this snapshot."}
            </p>
          )}
        </aside>
        <div className="file-workspace-editor">
          <div className="file-workspace-file-heading">
            <span dir="ltr">
              {selected || (ar ? "اختر ملفًا" : "Select a file")}
            </span>
            <div>
              <button
                type="button"
                className="button ghost small"
                disabled={blocked || !file}
                onClick={() => {
                  setPathAction("rename");
                  setNewPath(selected);
                }}
                aria-label={ar ? "أعد تسمية الملف" : "Rename file"}
              >
                <Pencil size={14} aria-hidden="true" />
              </button>
              <button
                type="button"
                className="button ghost small"
                disabled={blocked || !file}
                onClick={removeFile}
                aria-label={ar ? "احذف الملف" : "Delete file"}
              >
                <Trash2 size={14} aria-hidden="true" />
              </button>
            </div>
          </div>
          {file ? (
            <>
              <label
                className="file-workspace-content-label"
                htmlFor="workspace-file-content"
              >
                {ar ? "محتوى" : "Contents of"} {file.path}
              </label>
              <textarea
                id="workspace-file-content"
                dir="ltr"
                spellCheck={false}
                autoCapitalize="off"
                autoCorrect="off"
                readOnly={readOnly}
                disabled={busy || loading}
                value={file.content}
                onChange={(event) => {
                  const content = event.target.value;
                  setFiles((current) =>
                    current.map((item) =>
                      item.path === selected ? { ...item, content } : item,
                    ),
                  );
                  setNotice("");
                }}
              />
            </>
          ) : (
            <div className="file-workspace-empty">
              <FileCode2 size={35} aria-hidden="true" />
              <h2>
                {ar ? "مساحة لكل ملفات مشروعك" : "Room for your project files"}
              </h2>
              <p>
                {ar
                  ? "أضف ملفًا أو اختر ملفًا من القائمة لبدء التحرير."
                  : "Add a file or select one from the list to start editing."}
              </p>
            </div>
          )}
        </div>
      </section>
      <footer className="file-workspace-footer">
        <span role="status">
          {dirty
            ? ar
              ? `${changed.size} ملفات بتعديلات غير محفوظة`
              : `${changed.size} files with unsaved changes`
            : ar
              ? "لا تعديلات غير محفوظة"
              : "No unsaved changes"}
        </span>
        <span>
          {files.length} / {limits.files} {ar ? "ملف" : "files"} ·{" "}
          {Math.ceil(totalBytes / 1024)} /{" "}
          {Math.floor(limits.totalBytes / 1024)} KiB
        </span>
      </footer>
      <p className="file-workspace-footnote">
        {ar
          ? "المسودة تبقى في هذه الصفحة فقط. احفظها أو نزّل JSON قبل المغادرة. تنزيل ZIP يضم الإصدار المحفوظ المحدد، دون التعديلات غير المحفوظة."
          : "Drafts stay in this page only. Save or download JSON before leaving. ZIP contains the selected saved version, excluding unsaved edits."}
      </p>
    </main>
  );
}
