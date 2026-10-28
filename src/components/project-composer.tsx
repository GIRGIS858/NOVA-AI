"use client";

import { useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  ArrowUp,
  ArrowUpRight,
  LayoutTemplate,
  Palette,
  ShoppingBag,
  LoaderCircle,
} from "lucide-react";
import { createProject } from "@/app/actions";
import { DRAFT_KEY } from "@/lib/draft";

function SubmitProject({ ar }: { ar: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      className="button primary composer-submit"
      type="submit"
      disabled={pending}
    >
      {pending
        ? ar
          ? "جارٍ الحفظ…"
          : "Saving…"
        : ar
          ? "أنشئ المشروع"
          : "Create project"}
      {pending ? (
        <LoaderCircle size={17} className="spin" aria-hidden="true" />
      ) : (
        <ArrowUp size={17} aria-hidden="true" />
      )}
    </button>
  );
}

export function ProjectComposer({
  ar,
  initialIdea,
  hasError,
}: {
  ar: boolean;
  initialIdea: string;
  hasError: boolean;
}) {
  const [name, setName] = useState("");
  const [brief, setBrief] = useState(initialIdea);
  const [notice, setNotice] = useState("");
  const briefRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    try {
      const draft = sessionStorage.getItem(DRAFT_KEY);
      if (draft) setBrief(draft.slice(0, 8000));
    } catch {}
  }, []);
  function updateBrief(value: string) {
    setBrief(value);
    try {
      sessionStorage.setItem(DRAFT_KEY, value);
    } catch {}
  }
  const suggestions = [
    {
      icon: LayoutTemplate,
      title: ar ? "صفحة لفكرتك" : "Launch an idea",
      detail: ar
        ? "عرّف بمنتجك واجذب أول عملائك."
        : "Give your next product a place to begin.",
      name: ar ? "إطلاق منتجي" : "Product launch",
      brief: ar
        ? "صفحة تعريفية لمنتجي توضّح قيمته ومزاياه، مع أسئلة شائعة ونموذج للتواصل."
        : "A landing page for my product with a clear value proposition, features, frequently asked questions, and a contact form.",
    },
    {
      icon: Palette,
      title: ar ? "مساحة لأعمالك" : "Show your work",
      detail: ar
        ? "احكِ قصتك من خلال مشاريعك."
        : "Let your portfolio tell your story.",
      name: ar ? "معرض أعمالي" : "Creative portfolio",
      brief: ar
        ? "معرض أعمال إبداعي يعرض مشاريعي وقصتها، مع نبذة عني ووسيلة واضحة للتواصل."
        : "A creative portfolio showcasing my projects and their stories, with an about section and a clear way to get in touch.",
    },
    {
      icon: ShoppingBag,
      title: ar ? "واجهة لعلامتك" : "Shape a storefront",
      detail: ar
        ? "اعرض منتجاتك بأسلوب يشبهك."
        : "Find a home for your brand and products.",
      name: ar ? "واجهة متجري" : "Brand storefront",
      brief: ar
        ? "واجهة متجر لعلامتي التجارية تعرض المنتجات وصورها وتفاصيلها، مع أقسام للتصنيفات وقصة العلامة."
        : "A storefront for my brand with product images and details, category sections, and the story behind the brand.",
    },
  ];

  function addSuggestion(suggestion: (typeof suggestions)[number]) {
    const nextBrief = brief.trim()
      ? `${brief}\n\n${suggestion.brief}`
      : suggestion.brief;
    if (nextBrief.length > 8000) {
      setNotice(
        ar
          ? "الوصف ممتلئ. اختصره قبل إضافة الاقتراح."
          : "Your brief is full. Shorten it before adding a suggestion.",
      );
      return;
    }
    if (!name.trim()) setName(suggestion.name);
    updateBrief(nextBrief);
    setNotice(
      ar
        ? "تمت إضافة الاقتراح. عدّله بما يناسب فكرتك."
        : "Suggestion added. Make it your own before saving.",
    );
    briefRef.current?.focus();
  }

  return (
    <section
      className="composer-section"
      id="new-project"
      aria-label={ar ? "مشروع جديد" : "New project"}
    >
      <form action={createProject} className="project-composer">
        <label className="composer-name" htmlFor="project-name">
          {ar ? "اسم المشروع" : "Project name"}
          <input
            id="project-name"
            dir="auto"
            name="name"
            required
            minLength={2}
            maxLength={80}
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={ar ? "امنح فكرتك اسمًا…" : "Give your idea a name…"}
          />
        </label>
        <label className="composer-brief" htmlFor="project-brief">
          {ar ? "الفكرة والأهداف" : "Your idea and goals"}
          <textarea
            id="project-brief"
            dir="auto"
            ref={briefRef}
            name="brief"
            required
            minLength={10}
            maxLength={8000}
            value={brief}
            onChange={(event) => updateBrief(event.target.value)}
            aria-describedby="composer-help"
            placeholder={
              ar
                ? "تخيّل موقعك القادم… لمن تبنيه؟ وما الذي يجعله مميزًا؟"
                : "Imagine your next website… Who is it for, and what makes it yours?"
            }
          />
        </label>
        {hasError && (
          <p role="alert" className="form-error">
            {ar
              ? "أدخل اسمًا من حرفين ووصفًا من 10 أحرف على الأقل."
              : "Use a name of at least 2 characters and a brief of at least 10 characters."}
          </p>
        )}
        <div className="composer-footer">
          <span id="composer-help" className="composer-help">
            {ar
              ? "نحفظ فكرتك الآن. التوليد بالذكاء الاصطناعي قريبًا."
              : "Save your brief today. AI generation is coming later."}
          </span>
          <SubmitProject ar={ar} />
        </div>
      </form>
      <div className="suggestion-heading">
        <span>
          {ar
            ? "تحتاج نقطة بداية؟ أضف اقتراحًا إلى وصفك."
            : "Need a starting point? Add an idea to your brief."}
        </span>
      </div>
      <div className="suggestion-grid">
        {suggestions.map((suggestion) => (
          <button
            key={suggestion.name}
            type="button"
            className="suggestion-card"
            onClick={() => addSuggestion(suggestion)}
          >
            <suggestion.icon size={20} strokeWidth={1.5} aria-hidden="true" />
            <span className="suggestion-copy">
              <strong>{suggestion.title}</strong>
              <span>{suggestion.detail}</span>
            </span>
            <ArrowUpRight
              size={15}
              className="suggestion-arrow"
              aria-hidden="true"
            />
          </button>
        ))}
      </div>
      <p className="suggestion-notice" role="status">
        {notice}
      </p>
    </section>
  );
}
