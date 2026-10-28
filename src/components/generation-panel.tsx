"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Code2,
  Download,
  Eye,
  LoaderCircle,
  RefreshCw,
  Sparkles,
  Square,
} from "lucide-react";

type Run = {
  id: string;
  status: "running" | "succeeded" | "failed" | "cancelled";
  error_code: string | null;
  created_at: number;
  finished_at: number | null;
};
type VersionMeta = { id: string; created_at: number; run_id: string };
type SourceFile = { path: string; content: string };
type VersionResponse = {
  version: { id: string; created_at: number; files: SourceFile[] };
  preview: string;
};
type HistoryResponse = {
  runs: Run[];
  versions: VersionMeta[];
  configured: boolean;
};

function errorText(code: string, ar: boolean) {
  switch (code) {
    case "not_configured":
      return ar
        ? "التوليد غير مهيّأ بعد. يحتاج مسؤول البيئة إلى إعداد مزوّد الذكاء الاصطناعي."
        : "Generation is not configured yet. The environment owner needs to configure the AI provider.";
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
        ? "أُلغيت المحاولة. الإلغاء لا يضمن إلغاء تكلفة المزوّد."
        : "The attempt was cancelled. Cancellation does not guarantee a provider refund.";
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
        ? "تغيّر إصدار المشروع أثناء التوليد. حدّث السجل قبل بدء محاولة جديدة."
        : "The project version changed during generation. Refresh the history before starting another attempt.";
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
  initialRuns,
  initialVersions,
}: {
  projectId: string;
  ar: boolean;
  configured: boolean;
  initialRuns: Run[];
  initialVersions: VersionMeta[];
}) {
  const [runs, setRuns] = useState(initialRuns);
  const [versions, setVersions] = useState(initialVersions);
  const [ready, setReady] = useState(configured);
  const [pending, setPending] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [versionError, setVersionError] = useState("");
  const [selected, setSelected] = useState(initialVersions[0]?.id || "");
  const [versionData, setVersionData] = useState<VersionResponse | null>(null);
  const [loadingVersion, setLoadingVersion] = useState(false);
  const [versionRetry, setVersionRetry] = useState(0);
  const [view, setView] = useState<"preview" | "source">("preview");
  const [sourcePath, setSourcePath] = useState("index.html");
  const requestInFlight = useRef(false);
  const historyInFlight = useRef<Promise<HistoryResponse> | null>(null);
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
        setRuns(result.runs);
        setVersions(result.versions);
        setReady(result.configured);
        setSelected((current) =>
          preferLatest ||
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
    if (requestInFlight.current || active || !ready) return;
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
        {ar
          ? "ولّد موقعًا ثابتًا من الوصف والملاحظات المحفوظة. تُرسل هذه التفاصيل إلى مزوّد AI عند بدء التوليد؛ تطبّق رسوم المزوّد."
          : "Generate a static website from your saved brief and notes. Starting generation sends those details to the AI provider; provider charges apply."}
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
          disabled={!ready || pending || Boolean(active)}
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
          ? ar
            ? "المحاولة جارية. يمكنك إلغاؤها؛ قد تبقى رسوم المزوّد مستحقة."
            : "An attempt is running. You can cancel it; provider charges may still apply."
          : runs[0]
            ? statusLabel(runs[0].status)
            : ""}
      </div>

      {versions.length > 0 && (
        <div className="generation-version">
          <label htmlFor="source-version">
            {ar ? "الإصدار المحفوظ" : "Saved version"}
            <select
              id="source-version"
              value={selected}
              onChange={(event) => setSelected(event.target.value)}
            >
              {versions.map((version, index) => (
                <option key={version.id} value={version.id}>
                  {ar ? "نسخة" : "Version"} {versions.length - index} ·{" "}
                  {date(version.created_at)}
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
                    {statusLabel(run.status)}
                  </span>
                  <time dateTime={new Date(run.created_at).toISOString()}>
                    {date(run.created_at)}
                  </time>
                </div>
                {run.error_code && <p>{errorText(run.error_code, ar)}</p>}
              </li>
            ))}
          </ol>
        </details>
      )}
    </section>
  );
}
