"use client";
import { useRef, useState, useEffect } from "react";
import {
  ArrowUp,
  Sparkles,
  Lightbulb,
  PanelsTopLeft,
  ShoppingBag,
  Info,
  PenLine,
} from "lucide-react";
import { useRouter } from "next/navigation";
import type { Locale } from "@/lib/locale";
export const DRAFT_KEY = "nova.project-draft.v1";
export function IdeaComposer({ locale }: { locale: Locale }) {
  const ar = locale === "ar";
  const router = useRouter();
  const [idea, setIdea] = useState("");
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    try {
      setIdea(sessionStorage.getItem(DRAFT_KEY) || "");
    } catch {}
  }, []);
  const suggestions = [
    {
      icon: Lightbulb,
      title: ar ? "أطلق فكرتك" : "Launch an idea",
      desc: ar
        ? "صفحة تروي قصة مشروعك الجديد."
        : "A memorable home for your next big thing.",
      prompt: ar
        ? "أريد صفحة إطلاق لمنتج تقني، بهوية مميزة وقسم للمزايا ونموذج تسجيل اهتمام."
        : "Create a distinctive technology product launch page with features and an interest form.",
    },
    {
      icon: PanelsTopLeft,
      title: ar ? "ابنِ مساحة عمل" : "Build a workspace",
      desc: ar
        ? "لوحة تجمع أعمالك في مكان واحد."
        : "Bring your work together in one place.",
      prompt: ar
        ? "أريد لوحة لإدارة العملاء والمشاريع، مع بحث وحالات واضحة وتصميم متجاوب."
        : "Build a responsive customer and project dashboard with search and clear status indicators.",
    },
    {
      icon: ShoppingBag,
      title: ar ? "صمّم متجرًا" : "Design a storefront",
      desc: ar
        ? "تجربة تُظهر منتجاتك بأفضل صورة."
        : "Give your products a place to stand out.",
      prompt: ar
        ? "أريد متجر عطور بهوية راقية وصفحات منتجات واضحة وتجربة سهلة على الهاتف."
        : "Design an elegant fragrance storefront with clear product pages and an excellent mobile experience.",
    },
  ];
  return (
    <div className="creation-area">
      <div className="composer-shell">
        <div className="composer-ribbon">
          <Sparkles size={13} />
          <span>
            {ar
              ? "كل شيء يبدأ بفكرة. أعطِ فكرتك مساحة."
              : "A little spark. A whole world of possibility."}
          </span>
          <span className="ribbon-state">
            {ar ? "نسخة تأسيسية" : "EARLY ACCESS"}
          </span>
        </div>
        <form
          className="dark-composer"
          onSubmit={(event) => {
            event.preventDefault();
            setError(false);
            try {
              sessionStorage.setItem(DRAFT_KEY, idea);
              setBusy(true);
              router.push("/app");
            } catch {
              setError(true);
            }
          }}
        >
          <label className="sr-only" htmlFor="idea">
            {ar ? "صف فكرتك" : "Describe your idea"}
          </label>
          <textarea
            ref={input}
            id="idea"
            name="idea"
            value={idea}
            onChange={(e) => setIdea(e.target.value)}
            minLength={10}
            maxLength={8000}
            required
            placeholder={
              ar ? "صف ما تريد بناءه…" : "Describe what you want to build…"
            }
          />
          <div className="dark-composer-tools">
            <details className="prompt-help">
              <summary>
                <PenLine size={13} />
                {ar ? "نصائح للبدء" : "Prompt tips"}
              </summary>
              <p>
                {ar
                  ? "اذكر نوع المشروع، الجمهور، الصفحات المطلوبة، والهوية التي تتخيلها. تجنّب إدخال كلمات المرور أو مفاتيح API."
                  : "Describe the project, its audience, key pages, and the visual style you imagine. Keep passwords and API keys out of your brief."}
              </p>
            </details>
            <div className="composer-send">
              <span>{ar ? "ابدأ مشروعك" : "Start your project"}</span>
              <button
                type="submit"
                className="send-orb"
                aria-label={ar ? "ابدأ مشروعك" : "Start your project"}
                disabled={busy}
              >
                <ArrowUp size={19} />
              </button>
            </div>
          </div>
          {error && (
            <p className="form-error" role="alert">
              {ar
                ? "فعّل تخزين التبويب لحفظ فكرتك قبل الدخول، أو أنشئ المشروع مباشرة من صفحة المشاريع."
                : "Enable session storage to keep your draft through sign-in, or create the project from your projects page."}
            </p>
          )}
        </form>
      </div>
      <div className="suggestion-grid">
        {suggestions.map((s) => (
          <button
            className="suggestion-card"
            key={s.title}
            type="button"
            onClick={() => {
              setIdea(s.prompt);
              input.current?.focus();
            }}
          >
            <s.icon size={17} />
            <span>
              <strong>{s.title}</strong>
              <small>{s.desc}</small>
            </span>
          </button>
        ))}
      </div>
      <p className="composer-disclosure">
        <Info size={12} />
        {ar
          ? "المشاريع والملاحظات متاحة. توليد الشيفرة والمعاينة قيد التطوير."
          : "Projects and notes are available. Code generation and previews are in development."}
      </p>
    </div>
  );
}
