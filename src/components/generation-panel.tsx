"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Code2,
  Play,
  LoaderCircle,
  Square,
  PanelsTopLeft,
  RefreshCw,
} from "lucide-react";
import type { GenerationRun } from "@/lib/generation-runs";
import type { SourceVersion } from "@/lib/versions";

type Data = {
  config: { model: string; configured: boolean; freeOnly: boolean };
  runs: GenerationRun[];
  version: SourceVersion | null;
  preview: string | null;
};
function describeError(code: string, ar: boolean) {
  const messages: Record<string, [string, string]> = {
    NOT_CONFIGURED: [
      "أضف مفتاح OpenRouter في إعدادات البيئة لتفعيل التوليد.",
      "Add an OpenRouter key in environment settings to enable generation.",
    ],
    FREE_MODEL_REQUIRED: [
      "إعداد النموذج غير مجاني. اختر نموذجًا ينتهي بـ :free.",
      "Choose a model whose ID ends with :free.",
    ],
    FREE_MODEL_UNAVAILABLE: [
      "النموذج غير متاح مجانًا الآن. لم ننتقل لنموذج مدفوع.",
      "The model is not currently free. No paid fallback was used.",
    ],
    RATE_LIMITED: [
      "وصل المزوّد إلى حد الطلبات المجانية. حاول لاحقًا.",
      "The provider’s free rate limit was reached. Try later.",
    ],
    AUTH_FAILED: [
      "المزوّد رفض المفتاح أو صلاحيات الحساب. راجع الإعدادات الآمنة.",
      "The provider rejected the key or account access. Check secure settings.",
    ],
    DAILY_LIMIT: [
      "وصلت إلى حد 20 محاولة خلال 24 ساعة لهذا الحساب.",
      "This account reached its limit of 20 attempts per 24 hours.",
    ],
    BUSY: [
      "هناك عملية توليد تعمل لحسابك. انتظر أو ألغها أولًا.",
      "Your account already has an active generation. Wait or cancel it.",
    ],
    SOURCE_CONFLICT: [
      "تغيّر المشروع أثناء التوليد. حُفظت نسختك الأحدث دون استبدال.",
      "The project changed during generation. Your newer source was preserved.",
    ],
    INTERRUPTED: [
      "انقطعت العملية أو انتهت المهلة. لم تُحفظ نتيجة غير مكتملة.",
      "The run was interrupted or timed out. No partial source was saved.",
    ],
    INVALID_OUTPUT: [
      "لم يُرجع النموذج ملفات بالصيغة المطلوبة. جرّب طلبًا أصغر.",
      "The model did not return valid structured files. Try a smaller request.",
    ],
    INVALID_FILES: [
      "رُفضت الملفات لأنها تجاوزت قواعد المسارات أو حدود الحجم.",
      "The files exceeded path or size rules and were rejected.",
    ],
    CONTEXT_LIMIT: [
      "حجم المشروع أكبر من حد السياق لهذه المرحلة.",
      "This project exceeds the current generation context limit.",
    ],
  };
  return (
    messages[code]?.[ar ? 0 : 1] ||
    (ar
      ? "تعذّر إكمال التوليد. جرّب لاحقًا؛ لم نتجاوز الوضع المجاني."
      : "Generation could not complete. Try again later. Free-only mode was preserved.")
  );
}
export function GenerationPanel({ id, ar }: { id: string; ar: boolean }) {
  const [data, setData] = useState<Data | null>(null);
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"preview" | "files">("preview");
  const [selected, setSelected] = useState("");
  const requestId = useRef<string | null>(null);
  const endpoint = `/api/projects/${id}/generation`;
  const refresh = useCallback(async () => {
    try {
      const response = await fetch(endpoint, { cache: "no-store" });
      if (!response.ok) throw new Error();
      setData(await response.json());
    } catch {
      setError(
        ar ? "تعذّر تحميل حالة التوليد." : "Could not load generation status.",
      );
    }
  }, [endpoint, ar]);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  const active = data?.runs.find(
    (r) => r.status === "running" || r.status === "validating",
  );
  useEffect(() => {
    if (!busy && !active) return;
    const timer = setInterval(() => void refresh(), 1500);
    return () => clearInterval(timer);
  }, [busy, active, refresh]);
  const enabled = data?.config.configured && data.config.freeOnly;
  async function generate(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    requestId.current ||= crypto.randomUUID();
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, requestId: requestId.current }),
      });
      const result = await response.json();
      if (!response.ok) setError(describeError(result.error, ar));
      requestId.current = null;
      await refresh();
    } catch {
      setError(
        ar
          ? "انقطع الاتصال. حدّث الحالة قبل المحاولة مجددًا."
          : "Connection interrupted. Refresh status before retrying.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function cancel() {
    if (!active) return;
    try {
      const response = await fetch(endpoint, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ runId: active.id }),
      });
      if (!response.ok) throw new Error();
      await refresh();
    } catch {
      setError(
        ar
          ? "تعذّر تأكيد الإلغاء. حدّث الحالة."
          : "Cancellation was not confirmed. Refresh status.",
      );
    }
  }
  const latest = data?.runs[0];
  const file =
    data?.version?.files.find((f) => f.path === selected) ||
    data?.version?.files[0];
  const status: Record<string, string> = ar
    ? {
        running: "جارٍ التوليد",
        validating: "التحقق من الملفات",
        completed: "حُفظ إصدار الشيفرة",
        failed: "تعذّرت العملية",
        cancelled: "أُلغيت العملية",
      }
    : {
        running: "Generating",
        validating: "Validating files",
        completed: "Source version saved",
        failed: "Run failed",
        cancelled: "Cancelled",
      };
  return (
    <section className="generation-panel" aria-labelledby="generation-heading">
      <div className="generation-heading">
        <h3 id="generation-heading">
          <Code2 size={18} />
          {ar ? "ابنِ بالذكاء الاصطناعي" : "Build with AI"}
        </h3>
        <span className="pill">{ar ? "مجاني فقط" : "Free models only"}</span>
      </div>
      {data && (
        <p className="generation-model" dir="ltr">
          OpenRouter · {data.config.model}
        </p>
      )}
      {!data ? (
        <p role="status">{ar ? "جارٍ تحميل الحالة…" : "Loading status…"}</p>
      ) : !enabled ? (
        <p className="generation-notice">
          {describeError(
            data.config.freeOnly ? "NOT_CONFIGURED" : "FREE_MODEL_REQUIRED",
            ar,
          )}
        </p>
      ) : (
        <p className="generation-notice">
          {ar
            ? "سيُرسل وصف المشروع وطلبك وملفات الإصدار الحالي إلى OpenRouter والمزوّد الذي يشغّل النموذج. لا تدخل أسرارًا. لا انتقال لنموذج مدفوع؛ المجاني له حدود وتوفر متغير."
            : "Your project brief, request, and current source files will be sent to OpenRouter and the model’s provider. Keep secrets out. No paid fallback; free availability and quotas vary."}
        </p>
      )}
      <form onSubmit={generate}>
        <label htmlFor="generation-prompt">
          {ar
            ? "ما الذي تريد بناءه أو تغييره؟"
            : "What should we build or change?"}
        </label>
        <textarea
          id="generation-prompt"
          value={prompt}
          onChange={(e) => {
            setPrompt(e.target.value);
            requestId.current = null;
          }}
          required
          minLength={10}
          maxLength={8000}
          disabled={busy || Boolean(active)}
          placeholder={
            ar
              ? "ابنِ صفحة لمشروعي بتصميم احترافي ومتجاوب…"
              : "Build a polished, responsive page for my project…"
          }
        />
        <div className="generation-actions">
          <button
            className="button primary small"
            disabled={!enabled || busy || Boolean(active)}
          >
            {busy ? (
              <LoaderCircle size={15} className="spin" />
            ) : (
              <Play size={15} />
            )}{" "}
            {ar ? "ولّد الشيفرة مجانًا" : "Generate free source"}
          </button>
          {active && (
            <button
              type="button"
              className="button ghost small"
              onClick={cancel}
            >
              <Square size={13} />
              {ar ? "إلغاء التوليد" : "Cancel generation"}
            </button>
          )}
          <button
            type="button"
            className="button ghost small"
            onClick={() => void refresh()}
            aria-label={ar ? "تحديث حالة التوليد" : "Refresh generation status"}
          >
            <RefreshCw size={14} />
          </button>
        </div>
      </form>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      {latest && (
        <div className="generation-result" role="status">
          <strong>{status[latest.status]}</strong>
          {latest.error_code && <p>{describeError(latest.error_code, ar)}</p>}
          {latest.status === "completed" && (
            <p>
              {ar
                ? "الملفات محفوظة. المعاينة ثابتة؛ لم تُختبر وظائف JavaScript أو خادم التطبيق."
                : "Files are saved. The preview is static; JavaScript and application backend behavior have not been tested."}
            </p>
          )}
        </div>
      )}
      {data?.version && (
        <div className="generated-output">
          <div
            className="generation-tabs"
            role="group"
            aria-label={ar ? "عرض النتيجة" : "Result view"}
          >
            <button
              type="button"
              className={tab === "preview" ? "selected" : ""}
              onClick={() => setTab("preview")}
            >
              <PanelsTopLeft size={14} />
              {ar ? "معاينة ثابتة" : "Static preview"}
            </button>
            <button
              type="button"
              className={tab === "files" ? "selected" : ""}
              onClick={() => setTab("files")}
            >
              <Code2 size={14} />
              {ar ? "الملفات" : "Files"} ({data.version.fileCount})
            </button>
            <span>v{data.version.number}</span>
          </div>
          {tab === "preview" ? (
            data.preview ? (
              <iframe
                className="static-preview"
                title={ar ? "معاينة الموقع الثابتة" : "Static website preview"}
                sandbox=""
                referrerPolicy="no-referrer"
                srcDoc={data.preview}
              />
            ) : (
              <p>
                {ar
                  ? "لا يحتوي الإصدار على index.html لعرض معاينة ثابتة."
                  : "This version has no index.html for a static preview."}
              </p>
            )
          ) : (
            <div className="source-view">
              <label>
                {ar ? "الملف" : "File"}
                <select
                  dir="ltr"
                  value={file?.path || ""}
                  onChange={(e) => setSelected(e.target.value)}
                >
                  {data.version.files.map((f) => (
                    <option key={f.path} value={f.path}>
                      {f.path}
                    </option>
                  ))}
                </select>
              </label>
              <pre dir="ltr">
                <code>{file?.content || ""}</code>
              </pre>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
