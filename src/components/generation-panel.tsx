"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { SourceComparison } from "./source-comparison";
import { StaticSourceEditor } from "./static-source-editor";
import {
  Code2,
  Download,
  Eye,
  LoaderCircle,
  RefreshCw,
  Sparkles,
  Square,
} from "lucide-react";

type JobPhase =
  "queued" | "generating" | "validating" | "succeeded" | "failed" | "cancelled";
type Run = {
  phase?: JobPhase;
  events?: Array<{ phase: JobPhase; created_at: number }>;
  id: string;
  status: "running" | "succeeded" | "failed" | "cancelled";
  error_code: string | null;
  created_at: number;
  finished_at: number | null;
};
type VersionMeta = {
  id: string;
  created_at: number;
  number: number;
  restored_from: string | null;
};
type SourceFile = { path: string; content: string };
type VersionResponse = {
  version: { id: string; created_at: number; files: SourceFile[] };
  preview: string;
};
type HistoryResponse = {
  runs: Run[];
  versions: VersionMeta[];
  configured: boolean;
  model: string;
  provider: string;
};

function errorText(code: string, ar: boolean) {
  switch (code) {
    case "not_configured":
      return ar
        ? "التوليد غير مهيّأ بعد. جهّز النموذج المحدد واختبره قبل تفعيل التوليد."
        : "Generation is not configured yet. Prepare and validate the selected model before enabling generation.";
    case "configuration_changed":
      return ar
        ? "تغيّر إعداد النموذج منذ إضافة المهمة. راجع الإعدادات ثم ابدأ محاولة جديدة."
        : "The model configuration changed after enqueue. Review settings and start a new attempt.";
    case "local_model_unavailable":
      return ar
        ? "النموذج المحلي غير متاح. شغّل Ollama وتأكد من تنزيل النموذج على جهاز الخادم."
        : "Local model unavailable. Start Ollama and verify the model is downloaded on the application server.";
    case "free_model_required":
    case "free_model_unavailable":
      return ar
        ? "النموذج المجاني المحدد غير متاح أو لم يعد سعره صفرًا. اختر نموذجًا مجانيًا آخر في إعدادات البيئة."
        : "The selected free model is unavailable or no longer zero-priced. Configure another free model.";
    case "rate_limited":
      return ar
        ? "بلغت حصة المزوّد المجانية حدها. حاول لاحقًا."
        : "The provider’s free quota has been reached. Try again later.";
    case "auth_failed":
      return ar
        ? "رفض المزوّد مفتاح الاتصال. راجع إعدادات البيئة."
        : "The provider rejected the credential. Check environment settings.";
    case "catalog_unavailable":
      return ar
        ? "تعذّر التحقق من السعر المجاني. أوقفنا الطلب قبل التوليد."
        : "Free pricing could not be verified. The request stopped before generation.";
    case "forbidden":
      return ar
        ? "تعذّر التحقق من هذا الطلب. حدّث الصفحة وحاول مجددًا."
        : "This request could not be verified. Refresh the page and try again.";
    case "unauthorized":
      return ar
        ? "انتهت جلستك. سجّل الدخول مجددًا."
        : "Your session has expired. Sign in again.";
    case "unavailable":
    case "not_found":
    case "project_unavailable":
      return ar
        ? "هذا المشروع أو الإصدار غير متاح لحسابك."
        : "This project or version is unavailable to your account.";
    case "daily_limit":
    case "user_daily_limit":
    case "owner_daily_limit":
      return ar
        ? "استخدمت محاولات حسابك الثلاث خلال آخر ٢٤ ساعة. انتظر خروج إحدى المحاولات من هذه الفترة ثم حاول مجددًا."
        : "You have used your 3 attempts within the last 24 hours. Try again once an earlier attempt leaves that window.";
    case "global_daily_limit":
      return ar
        ? "وصلت البيئة إلى حد المحاولات خلال آخر ٢٤ ساعة. انتظر خروج محاولة سابقة من هذه الفترة ثم حاول مجددًا."
        : "The environment has reached its limit for the last 24 hours. Try again once an earlier attempt leaves that window.";
    case "busy":
    case "owner_busy":
    case "global_busy":
      return ar
        ? "توجد عملية توليد قيد التنفيذ. انتظر اكتمالها ثم حاول مجددًا."
        : "Generation is already in progress. Wait for it to finish, then try again.";
    case "timeout":
    case "interrupted":
      return ar
        ? "انتهت مهلة المحاولة أو انقطعت. لم تُحفظ نسخة جديدة؛ يمكنك بدء محاولة أخرى."
        : "The attempt timed out or was interrupted. No new version was saved; you can start another attempt.";
    case "cancelled":
      return ar
        ? "أُلغيت المحاولة. تبقى محسوبة ضمن حد المحاولات."
        : "The attempt was cancelled. It still counts toward the attempt limit.";
    case "context_limit":
      return ar
        ? "حجم وصف المشروع وملفاته يتجاوز حد طلب AI. لم نرسل ملفات ناقصة؛ قلّل الحجم أو تابع بالمحرّر اليدوي."
        : "The project requirements and files exceed the AI context limit. No partial files were sent; reduce the size or use the manual editor.";
    case "invalid_output":
      return ar
        ? "لم يجتز الناتج فحص الملفات. لم تُحفظ نسخة جديدة."
        : "The output did not pass file validation. No new version was saved.";
    case "source_limit":
      return ar
        ? "وصل هذا المشروع إلى حد النسخ المحفوظة. لا يمكن حفظ نسخة إضافية الآن."
        : "This project has reached its saved-version limit. Another version cannot be saved right now.";
    case "unsupported_source":
      return ar
        ? "هذا الإصدار يحتوي على ملفات غير مدعومة في المعاينة الثابتة. تدعم المعاينة HTML وCSS فقط."
        : "This version contains files that the static preview does not support. Preview supports HTML and CSS only.";
    case "conflict":
      return ar
        ? "تغيّر إصدار المشروع منذ فتحه. حدّث السجل وافتح النسخة الأحدث قبل المحاولة مجددًا."
        : "The project version changed since it was opened. Refresh the history and open the latest version before trying again.";
    case "request_conflict":
    case "invalid_request":
      return ar
        ? "تعذّر بدء هذه المحاولة. حدّث الصفحة وحاول مجددًا."
        : "This attempt could not start. Refresh the page and try again.";
    default:
      return ar
        ? "تعذّرت العملية. حدّث السجل لمعرفة حالتها قبل المحاولة مجددًا."
        : "The operation failed. Refresh the history to check its status before trying again.";
  }
}

async function readResponse<T>(response: Response): Promise<T> {
  const body = await response.json();
  if (!response.ok)
    throw new Error(
      typeof body.error === "string" ? body.error : "request_failed",
    );
  return body as T;
}

export function GenerationPanel({
  projectId,
  ar,
  configured,
  model,
  provider,
  initialRuns,
  initialVersions,
}: {
  projectId: string;
  ar: boolean;
  configured: boolean;
  model: string;
  provider: string;
  initialRuns: Run[];
  initialVersions: VersionMeta[];
}) {
  const [runs, setRuns] = useState(initialRuns);
  const [versions, setVersions] = useState(initialVersions);
  const [ready, setReady] = useState(configured);
  const [currentModel, setCurrentModel] = useState(model);
  const [currentProvider, setCurrentProvider] = useState(provider);
  const [pending, setPending] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [versionError, setVersionError] = useState("");
  const [selected, setSelected] = useState(initialVersions[0]?.id || "");
  const [versionData, setVersionData] = useState<VersionResponse | null>(null);
  const [loadingVersion, setLoadingVersion] = useState(false);
  const [versionRetry, setVersionRetry] = useState(0);
  const [view, setView] = useState<"preview" | "source" | "compare">("preview");
  const [sourcePath, setSourcePath] = useState("index.html");
  const [editor, setEditor] = useState<{
    baseVersionId: string | null;
    files: SourceFile[];
  } | null>(null);
  const [restoring, setRestoring] = useState(false);
  const restoreInFlight = useRef(false);
  const [sourceNotice, setSourceNotice] = useState("");
  const requestInFlight = useRef(false);
  const historyInFlight = useRef<Promise<HistoryResponse> | null>(null);
  const hadActiveRun = useRef(
    initialRuns.some((run) => run.status === "running"),
  );
  const active = runs.find((run) => run.status === "running");
  const base = `/api/projects/${encodeURIComponent(projectId)}`;

  const refreshHistory = useCallback(
    async (preferLatest = false) => {
      const request =
        historyInFlight.current ||
        fetch(`${base}/generation`, { cache: "no-store" }).then(
          readResponse<HistoryResponse>,
        );
      historyInFlight.current = request;
      try {
        const result = await request;
        const justFinished =
          hadActiveRun.current &&
          !result.runs.some((run) => run.status === "running");
        hadActiveRun.current = result.runs.some(
          (run) => run.status === "running",
        );
        setRuns(result.runs);
        setVersions(result.versions);
        setReady(result.configured);
        setCurrentModel(result.model);
        setCurrentProvider(result.provider);
        setSelected((current) =>
          preferLatest ||
          justFinished ||
          !result.versions.some((version) => version.id === current)
            ? result.versions[0]?.id || ""
            : current,
        );
      } finally {
        if (historyInFlight.current === request) historyInFlight.current = null;
      }
    },
    [base],
  );

  useEffect(() => {
    if (!pending && !active) return;
    const interval = window.setInterval(() => {
      void refreshHistory().catch(() => setError("request_failed"));
    }, 1500);
    return () => window.clearInterval(interval);
  }, [pending, active, refreshHistory]);

  useEffect(() => {
    if (!selected) {
      setVersionData(null);
      return;
    }
    const controller = new AbortController();
    setVersionData(null);
    setVersionError("");
    setLoadingVersion(true);
    void fetch(`${base}/versions/${encodeURIComponent(selected)}`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(readResponse<VersionResponse>)
      .then((data) => {
        if (!controller.signal.aborted) setVersionData(data);
      })
      .catch((reason: unknown) => {
        if (!controller.signal.aborted)
          setVersionError(
            reason instanceof Error ? reason.message : "request_failed",
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadingVersion(false);
      });
    return () => controller.abort();
  }, [base, selected, versionRetry]);

  async function generate() {
    if (requestInFlight.current || active || !ready || editor || restoring)
      return;
    requestInFlight.current = true;
    setPending(true);
    setError("");
    try {
      await readResponse<{ run: Run }>(
        await fetch(`${base}/generate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ requestId: crypto.randomUUID() }),
          signal: AbortSignal.timeout(100000),
        }),
      );
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "request_failed");
    } finally {
      try {
        await refreshHistory(true);
      } catch {
        setError("request_failed");
      }
      setPending(false);
      requestInFlight.current = false;
    }
  }

  async function cancel() {
    if (!active || cancelling) return;
    setCancelling(true);
    setError("");
    try {
      await readResponse<{ run: Run }>(
        await fetch(
          `${base}/generation/${encodeURIComponent(active.id)}/cancel`,
          { method: "POST" },
        ),
      );
      await refreshHistory();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "request_failed");
    } finally {
      setCancelling(false);
    }
  }

  async function refresh() {
    setRefreshing(true);
    setError("");
    try {
      await refreshHistory();
    } catch {
      setError("request_failed");
    } finally {
      setRefreshing(false);
    }
  }

  function sourceSaved(version: VersionMeta) {
    setEditor(null);
    setVersions((current) => [
      version,
      ...current.filter((v) => v.id !== version.id),
    ]);
    setSelected(version.id);
    setView("preview");
    setError("");
    setSourceNotice(
      ar
        ? "حُفظ إصدار جديد ويمكنك معاينته الآن."
        : "A new version was saved and is ready to preview.",
    );
    void (async () => {
      await historyInFlight.current?.catch(() => undefined);
      await refreshHistory(true);
    })().catch(() => setError("request_failed"));
  }

  async function restoreVersion() {
    const latest = versions[0]?.id;
    if (
      restoreInFlight.current ||
      !latest ||
      !selected ||
      latest === selected ||
      editor
    )
      return;
    if (
      !window.confirm(
        ar
          ? "استعادة هذا الإصدار كنسخة جديدة؟ ستبقى جميع النسخ السابقة محفوظة."
          : "Restore this version as a new snapshot? All previous versions will be retained.",
      )
    )
      return;
    restoreInFlight.current = true;
    setRestoring(true);
    setError("");
    try {
      const result = await readResponse<{ version: VersionMeta }>(
        await fetch(`${base}/source/restore`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ baseVersionId: latest, versionId: selected }),
        }),
      );
      sourceSaved(result.version);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "source_failed");
    } finally {
      restoreInFlight.current = false;
      setRestoring(false);
    }
  }

  function download() {
    if (!versionData) return;
    const blob = new Blob(
      [
        JSON.stringify(
          { version: versionData.version.id, files: versionData.version.files },
          null,
          2,
        ),
      ],
      { type: "application/json" },
    );
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `nova-source-${versionData.version.id}.json`;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  const date = (value: number) =>
    new Intl.DateTimeFormat(ar ? "ar" : "en", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date(value));
  const phaseLabel = (phase: JobPhase) =>
    ({
      queued: ar ? "بانتظار التنفيذ" : "Queued",
      generating: ar ? "قيد التوليد" : "Generating",
      validating: ar ? "جارٍ التحقق من الملفات" : "Validating files",
      succeeded: ar ? "نسخة محفوظة" : "Version saved",
      failed: ar ? "لم تكتمل" : "Failed",
      cancelled: ar ? "ملغاة" : "Cancelled",
    })[phase];
  const statusLabel = (status: Run["status"]) =>
    ({
      running: ar ? "قيد التوليد" : "Generating",
      succeeded: ar ? "نسخة محفوظة" : "Version saved",
      failed: ar ? "لم تكتمل" : "Failed",
      cancelled: ar ? "ملغاة" : "Cancelled",
    })[status];

  return (
    <section className="generation-panel" aria-labelledby="generation-title">
      <div className="generation-heading">
        <div>
          <p className="overline">HTML + CSS</p>
          <h3 id="generation-title">
            {ar ? "من الفكرة إلى أول نسخة" : "From a brief to a first version"}
          </h3>
        </div>
        <Sparkles size={23} aria-hidden="true" />
      </div>
      <p className="generation-description">
        {currentProvider === "ollama"
          ? ar
            ? "ابنِ أو طوّر الموقع باستخدام الوصف والملاحظات والملفات المحفوظة. يعالجها نموذج Ollama على نفس جهاز خادم Nova، دون مفتاح اشتراك أو تحويل تلقائي إلى مزوّد خارجي. لا تضع أسرارًا في ملفات المشروع."
            : "Build or update the website using saved requirements and source files. Ollama processes them on the Nova server’s own machine, without a subscription key or automatic remote fallback. Keep secrets out of project files."
          : ar
            ? "تُرسل بيانات المشروع وملفاته إلى OpenRouter ومزوّد النموذج المحدد عند التوليد. يُسمح فقط بنماذج متحقق من سعرها المجاني."
            : "Generation sends saved requirements and source files to OpenRouter and the selected model provider. Only verified zero-priced models are allowed."}
      </p>
      <p className="generation-limits" dir="ltr">
        {currentProvider === "ollama"
          ? "Ollama · local"
          : "OpenRouter · free only"}{" "}
        · {currentModel || (ar ? "لم يُحدد نموذج" : "No model selected")}
      </p>
      <p className="generation-limits">
        {ar
          ? "٣ محاولات لكل حساب، و٢٠ للبيئة، خلال أي فترة من ٢٤ ساعة. تدعم هذه المرحلة HTML وCSS فقط؛ دون JavaScript أو نشر عام."
          : "3 attempts per account and 20 across the environment in any 24-hour window. This milestone supports HTML and CSS, without JavaScript or public publishing."}
      </p>
      {!ready && (
        <p className="generation-unavailable" role="status">
          {errorText("not_configured", ar)}
        </p>
      )}
      <div className="generation-actions">
        <button
          className="button primary small"
          type="button"
          onClick={() => void generate()}
          disabled={
            !ready || pending || Boolean(active) || Boolean(editor) || restoring
          }
        >
          {pending || active ? (
            <LoaderCircle size={15} className="spin" aria-hidden="true" />
          ) : (
            <Sparkles size={15} aria-hidden="true" />
          )}
          {pending || active
            ? ar
              ? "جارٍ التوليد…"
              : "Generating…"
            : ar
              ? "ولّد نسخة جديدة"
              : "Generate a new version"}
        </button>
        {active && (
          <button
            className="button ghost small"
            type="button"
            disabled={cancelling}
            onClick={() => void cancel()}
          >
            <Square size={13} aria-hidden="true" />
            {cancelling
              ? ar
                ? "جارٍ الإلغاء…"
                : "Cancelling…"
              : ar
                ? "ألغِ المحاولة"
                : "Cancel attempt"}
          </button>
        )}
        <button
          className="button ghost small generation-refresh"
          type="button"
          onClick={() => void refresh()}
          disabled={refreshing}
        >
          <RefreshCw
            size={14}
            className={refreshing ? "spin" : ""}
            aria-hidden="true"
          />
          {ar ? "حدّث السجل" : "Refresh history"}
        </button>
      </div>
      {error && (
        <p role="alert" className="form-error">
          {errorText(error, ar)}
        </p>
      )}
      <div className="generation-live" role="status" aria-live="polite">
        {active
          ? phaseLabel(active.phase || "generating")
          : runs[0]
            ? statusLabel(runs[0].status)
            : ""}
      </div>
      {active && (
        <p className="generation-preview-note">
          {ar
            ? "المهمة محفوظة وتستمر بعد إغلاق الصفحة. يمكنك العودة لمتابعتها أو إلغائها."
            : "This saved task continues after you close the page. Return to follow progress or cancel it."}
        </p>
      )}

      <div className="generation-actions">
        <button
          className="button ghost small"
          type="button"
          disabled={
            Boolean(editor) ||
            pending ||
            Boolean(active) ||
            restoring ||
            (versions.length > 0 &&
              (!versionData ||
                versionData.version.id !== selected ||
                selected !== versions[0].id))
          }
          onClick={() => {
            setSourceNotice("");
            setEditor({
              baseVersionId: versions[0]?.id || null,
              files: versionData?.version.files || [
                { path: "index.html", content: "" },
                { path: "styles.css", content: "" },
              ],
            });
          }}
        >
          <Code2 size={15} aria-hidden="true" />
          {versions.length
            ? ar
              ? "عدّل النسخة الأحدث"
              : "Edit latest version"
            : ar
              ? "أضف ملفات يدويًا"
              : "Add files manually"}
        </button>
        {versions.length > 0 && selected !== versions[0].id && (
          <button
            className="button ghost small"
            type="button"
            disabled={
              Boolean(editor) ||
              restoring ||
              pending ||
              Boolean(active) ||
              !versionData
            }
            onClick={() => void restoreVersion()}
          >
            {restoring
              ? ar
                ? "جارٍ الاستعادة…"
                : "Restoring…"
              : ar
                ? "استعد كإصدار جديد"
                : "Restore as a new version"}
          </button>
        )}
      </div>
      {sourceNotice && (
        <p role="status" className="generation-preview-note">
          {sourceNotice}
        </p>
      )}
      {editor && (
        <StaticSourceEditor
          projectId={projectId}
          ar={ar}
          baseVersionId={editor.baseVersionId}
          initialFiles={editor.files}
          onSaved={sourceSaved}
          onClose={() => setEditor(null)}
          errorMessage={(code) => errorText(code, ar)}
        />
      )}
      {versions.length > 0 && (
        <div className="generation-version">
          <label htmlFor="source-version">
            {ar ? "الإصدار المحفوظ" : "Saved version"}
            <select
              id="source-version"
              value={selected}
              disabled={Boolean(editor) || restoring}
              onChange={(event) => setSelected(event.target.value)}
            >
              {versions.map((version) => (
                <option key={version.id} value={version.id}>
                  {ar ? "نسخة" : "Version"} {version.number} ·{" "}
                  {date(version.created_at)}
                  {version.restored_from
                    ? ar
                      ? " · مستعاد"
                      : " · restored"
                    : ""}
                </option>
              ))}
            </select>
          </label>
          <div
            className="generation-view-actions"
            aria-label={ar ? "طريقة عرض الإصدار" : "Version view"}
          >
            <button
              type="button"
              aria-pressed={view === "preview"}
              className="button ghost small"
              onClick={() => setView("preview")}
            >
              <Eye size={15} aria-hidden="true" />
              {ar ? "المعاينة" : "Preview"}
            </button>
            <button
              type="button"
              aria-pressed={view === "source"}
              className="button ghost small"
              onClick={() => setView("source")}
            >
              <Code2 size={15} aria-hidden="true" />
              {ar ? "الملفات" : "Source"}
            </button>
            <button
              type="button"
              className="button ghost small"
              aria-pressed={view === "compare"}
              onClick={() => setView("compare")}
            >
              {ar ? "قارن الإصدارات" : "Compare versions"}
            </button>
            <button
              type="button"
              className="button ghost small"
              disabled={!versionData}
              onClick={download}
            >
              <Download size={15} aria-hidden="true" />
              {ar ? "تنزيل JSON" : "Download JSON"}
            </button>
          </div>
          {loadingVersion && (
            <p role="status" className="muted">
              {ar ? "جارٍ تحميل الإصدار…" : "Loading version…"}
            </p>
          )}
          {versionError && (
            <div className="generation-load-error">
              <p role="alert" className="form-error">
                {errorText(versionError, ar)}
              </p>
              <button
                type="button"
                className="button ghost small"
                onClick={() => setVersionRetry((value) => value + 1)}
              >
                {ar ? "أعد تحميل الإصدار" : "Reload version"}
              </button>
            </div>
          )}
          {versionData && view === "preview" && (
            <>
              <p className="generation-preview-note">
                {ar
                  ? "معاينة معزولة: السكربتات والاتصالات الخارجية معطّلة. ليست رابطًا منشورًا."
                  : "Isolated preview: scripts and external requests are disabled. This is not a published URL."}
              </p>
              <iframe
                key={versionData.version.id}
                title={
                  ar ? "معاينة الموقع المعزولة" : "Isolated website preview"
                }
                sandbox=""
                srcDoc={versionData.preview}
                referrerPolicy="no-referrer"
                className="generation-preview"
              />
            </>
          )}
          {versionData &&
            versionData.version.id === selected &&
            view === "compare" && (
              <SourceComparison
                key={selected}
                projectId={projectId}
                selected={selected}
                files={versionData.version.files}
                versions={versions}
                ar={ar}
              />
            )}
          {versionData && view === "source" && (
            <div className="generation-source">
              <div
                className="generation-file-tabs"
                aria-label={ar ? "ملفات الإصدار" : "Version files"}
              >
                {versionData.version.files.map((file) => (
                  <button
                    key={file.path}
                    type="button"
                    aria-pressed={sourcePath === file.path}
                    onClick={() => setSourcePath(file.path)}
                  >
                    {file.path}
                  </button>
                ))}
              </div>
              <pre
                dir="ltr"
                tabIndex={0}
                aria-label={ar ? "محتوى الملف" : "File contents"}
              >
                <code>
                  {versionData.version.files.find(
                    (file) => file.path === sourcePath,
                  )?.content || ""}
                </code>
              </pre>
            </div>
          )}
        </div>
      )}
      {!versions.length && (
        <div className="generation-empty">
          <Code2 size={22} aria-hidden="true" />
          <p>
            {ar
              ? "لم تُحفظ ملفات موقع لهذا المشروع بعد."
              : "No website files have been saved for this project yet."}
          </p>
        </div>
      )}
      {runs.length > 0 && (
        <details className="generation-history">
          <summary>
            {ar ? "سجل المحاولات" : "Attempt history"}{" "}
            <span>({runs.length})</span>
          </summary>
          <ol>
            {runs.map((run) => (
              <li key={run.id}>
                <div>
                  <span className={`generation-run-status run-${run.status}`}>
                    {run.status === "running"
                      ? phaseLabel(run.phase || "generating")
                      : statusLabel(run.status)}
                  </span>
                  <time dateTime={new Date(run.created_at).toISOString()}>
                    {date(run.created_at)}
                  </time>
                </div>
                {run.events && run.events.length > 0 && (
                  <ol
                    className="generation-events"
                    aria-label={ar ? "مراحل المهمة" : "Task progress"}
                  >
                    {run.events.map((event, index) => (
                      <li key={index}>
                        <span>{phaseLabel(event.phase)}</span>
                        {" · "}
                        <time
                          dateTime={new Date(event.created_at).toISOString()}
                        >
                          {date(event.created_at)}
                        </time>
                      </li>
                    ))}
                  </ol>
                )}
                {run.error_code && <p>{errorText(run.error_code, ar)}</p>}
              </li>
            ))}
          </ol>
        </details>
      )}
    </section>
  );
}
