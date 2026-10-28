import Link from "next/link";
import {
  ArrowUpLeft,
  ArrowUpRight,
  ArrowRight,
  Layers3,
  Code2,
  PanelsTopLeft,
  ShieldCheck,
  Plus,
  Sparkles,
  Check,
  ArrowDown,
} from "lucide-react";
import { Brand } from "@/components/brand";
import { LocaleButton } from "@/components/locale-button";
import { getLocale } from "@/lib/locale";

export default async function Home() {
  const locale = await getLocale();
  const ar = locale === "ar";
  const examples = ar
    ? [
        "موقع لاستوديو معماري",
        "متجر لعلامة عطور",
        "لوحة لإدارة العملاء",
        "صفحة لإطلاق منتج",
      ]
    : [
        "An architecture studio",
        "A fragrance storefront",
        "A customer dashboard",
        "A product launch page",
      ];
  return (
    <div className="marketing">
      <header className="site-header">
        <Brand />
        <nav className="desktop-nav">
          <a href="#possibilities">{ar ? "ما الذي ستبنيه؟" : "Explore"}</a>
          <a href="#workflow">{ar ? "كيف تعمل" : "How it works"}</a>
          <Link href="/roadmap">{ar ? "خارطة الطريق" : "Roadmap"}</Link>
        </nav>
        <div className="header-actions">
          <LocaleButton locale={locale} />
          <Link className="button dark small" href="/app">
            {ar ? "مساحة العمل" : "Workspace"}
            <ArrowUpLeft size={15} />
          </Link>
        </div>
      </header>
      <main>
        <section className="hero">
          <div className="hero-glow" aria-hidden="true" />
          <div className="eyebrow">
            <span className="status-dot" />
            {ar
              ? "مساحة جديدة للأفكار الطموحة"
              : "A new home for ambitious ideas"}
            <span className="tag">FOUNDATION 01</span>
          </div>
          <h1>
            {ar ? (
              <>
                فكرتك القادمة.
                <br />
                <span className="serif accent">بداية تستحقها.</span>
              </>
            ) : (
              <>
                Your next big idea.
                <br />
                <span className="serif accent">A beautiful beginning.</span>
              </>
            )}
          </h1>
          <p className="hero-description">
            {ar
              ? "من أول فكرة إلى تفاصيل المشروع. مساحة واحدة لتخطط، تصمم، وتبني ما تتخيله."
              : "From the first spark to the finer details. One thoughtful workspace to plan, design, and build what’s next."}
          </p>
          <form className="idea-composer" action="/app">
            <label htmlFor="idea" className="sr-only">
              {ar ? "صف فكرتك" : "Describe your idea"}
            </label>
            <textarea
              id="idea"
              name="idea"
              placeholder={
                ar
                  ? "لو كان بإمكانك بناء أي شيء… بماذا ستبدأ؟"
                  : "If you could build anything… where would you start?"
              }
              maxLength={8000}
              required
              minLength={10}
            />
            <div className="composer-bottom">
              <span className="muted composer-note">
                <Sparkles size={15} />
                {ar ? "أعطِ فكرتك مساحة" : "Make room for your idea"}
              </span>
              <button className="button primary" type="submit">
                {ar ? "ابدأ مشروعك" : "Start your project"}
                {ar ? <ArrowUpLeft size={18} /> : <ArrowUpRight size={18} />}
              </button>
            </div>
          </form>
          <div className="prompt-examples">
            {examples.map((text) => (
              <Link
                key={text}
                href={`/app?idea=${encodeURIComponent(ar ? `أريد بناء ${text} بتصميم احترافي ومتجاوب.` : `Build ${text} with a polished, responsive design.`)}`}
              >
                <Plus size={13} />
                {text}
              </Link>
            ))}
          </div>
          <p className="honesty-note">
            {ar
              ? "نسخة تأسيسية: الحسابات والمشاريع تعمل. توليد الشيفرة والمعاينات قيد التطوير."
              : "Foundation release: accounts and projects are live. AI generation and previews are in development."}
          </p>
        </section>
        <section className="showcase section-shell" id="possibilities">
          <div className="section-heading">
            <div>
              <p className="overline">
                {ar ? "مساحة للاحتمالات" : "ROOM FOR POSSIBILITY"}
              </p>
              <h2>
                {ar
                  ? "أفكار مختلفة. شخصيات مختلفة."
                  : "Different ideas. Distinct personalities."}
              </h2>
            </div>
            <span className="subtle-label">
              {ar
                ? "اتجاهات تصميمية توضيحية"
                : "Illustrative design directions"}
              <ArrowDown size={14} />
            </span>
          </div>
          <div className="showcase-grid">
            <article className="showcase-card">
              <div className="mock-browser">
                <span />
                <span />
                <span />
              </div>
              <div className="architecture-art" dir="ltr">
                <div className="mock-nav">
                  FORMA<span>Architecture & spaces ↗</span>
                </div>
                <div className="arch-columns">
                  <i />
                  <i />
                  <i />
                </div>
                <p>
                  Spaces for
                  <br />
                  <em>the way we live.</em>
                </p>
                <span className="mock-caption">
                  THOUGHTFULLY DESIGNED. HUMAN BY NATURE.
                </span>
              </div>
              <div className="showcase-caption">
                <span>{ar ? "مساحات تحكي قصصًا" : "Spaces with a story"}</span>
                <span>01 — PORTFOLIO</span>
              </div>
            </article>
            <article className="showcase-card">
              <div className="mock-browser">
                <span />
                <span />
                <span />
              </div>
              <div className="analytics-art" dir="ltr">
                <div className="mock-nav">
                  ◈ Orbit<span>Overview · Reports</span>
                </div>
                <small>YOUR BUSINESS, IN FOCUS</small>
                <h3>A little more clarity.</h3>
                <div className="demo-metrics">
                  <div>
                    <small>Revenue · sample</small>
                    <strong>$24,680</strong>
                    <span>↗ 18.6%</span>
                  </div>
                  <div className="bar-chart">
                    {[35, 55, 40, 68, 58, 83, 74, 95].map((h, i) => (
                      <i key={i} style={{ height: `${h}%` }} />
                    ))}
                  </div>
                </div>
                <div className="mock-lines">
                  <span />
                  <span />
                </div>
              </div>
              <div className="showcase-caption">
                <span>
                  {ar
                    ? "بيانات أوضح. قرارات أفضل."
                    : "Clearer data. Better decisions."}
                </span>
                <span>02 — DASHBOARD</span>
              </div>
            </article>
            <article className="showcase-card">
              <div className="mock-browser">
                <span />
                <span />
                <span />
              </div>
              <div className="store-art" dir="ltr">
                <div className="mock-nav">
                  aura<span>Objects for everyday rituals</span>
                </div>
                <div className="product-scene">
                  <div className="bottle">
                    <span>
                      aura
                      <br />
                      <small>EAU DE PARFUM</small>
                    </span>
                  </div>
                  <div className="bottle small-bottle" />
                </div>
                <p>
                  Less, but <em>better.</em>
                </p>
                <span className="mock-caption">
                  THE EVERYDAY COLLECTION — 2026
                </span>
              </div>
              <div className="showcase-caption">
                <span>
                  {ar ? "منتجات تستحق الظهور" : "Objects worth discovering"}
                </span>
                <span>03 — COMMERCE</span>
              </div>
            </article>
          </div>
        </section>
        <section className="workflow section-shell" id="workflow">
          <div>
            <p className="overline">{ar ? "بداية واضحة" : "A CLEAR START"}</p>
            <h2>
              {ar ? (
                <>
                  من الفكرة،
                  <br />
                  خطوة بخطوة.
                </>
              ) : (
                <>
                  From a spark,
                  <br />
                  step by step.
                </>
              )}
            </h2>
            <Link href="/app" className="text-link">
              {ar ? "أنشئ أول مشروع" : "Create your first project"}
              <ArrowRight size={17} />
            </Link>
          </div>
          <div className="steps">
            {[
              {
                icon: Layers3,
                title: ar ? "ضع الأساس" : "Set the foundation",
                text: ar
                  ? "أنشئ مشروعك، واكتب الفكرة والأهداف. كل التفاصيل محفوظة في مساحة خاصة بك."
                  : "Create a project and capture your goals. Keep the details together in your own workspace.",
                live: true,
              },
              {
                icon: Code2,
                title: ar ? "ابنِ بالمحادثة" : "Build through conversation",
                text: ar
                  ? "توليد ملفات حقيقية وتعديلات محددة، مع تتبع الإصدارات والاستهلاك."
                  : "Real files, focused changes, and a transparent history of versions and usage.",
                live: false,
              },
              {
                icon: PanelsTopLeft,
                title: ar ? "شاهد، ثم انشر" : "Preview, then publish",
                text: ar
                  ? "معاينات معزولة ونشر بإصدارات قابلة للاسترجاع. لن نعلن نجاحًا قبل التحقق منه."
                  : "Isolated previews and versioned deployments. Success means a verified result.",
                live: false,
              },
            ].map((s, i) => (
              <article className="step" key={s.title}>
                <span className="step-number">0{i + 1}</span>
                <div>
                  <h3>
                    {s.title}
                    <span className={`pill ${s.live ? "live" : ""}`}>
                      {s.live
                        ? ar
                          ? "متاح الآن"
                          : "Available"
                        : ar
                          ? "قادم"
                          : "Planned"}
                    </span>
                  </h3>
                  <p>{s.text}</p>
                </div>
                <s.icon size={22} />
              </article>
            ))}
          </div>
        </section>
        <section className="closing section-shell">
          <ShieldCheck size={25} />
          <h2>
            {ar ? "طموح كبير. خطوات صادقة." : "Big ambition. Honest progress."}
          </h2>
          <p>
            {ar
              ? "لا أرصدة وهمية، ولا نتائج مولّدة مسبقًا. نبني Nova مرحلة بمرحلة، بميزات يمكنك التحقق منها."
              : "No pretend credits or pre-generated results. We’re building Nova in verifiable, usable stages."}
          </p>
          <Link className="button dark" href="/app">
            {ar ? "ادخل مساحة العمل" : "Enter your workspace"}
            <Check size={17} />
          </Link>
        </section>
      </main>
      <footer className="site-footer section-shell">
        <Brand />
        <span>
          {ar
            ? "صُممت للأفكار التي تستحق أن تُبنى."
            : "For ideas that deserve to be built."}
        </span>
        <Link href="/roadmap">
          {ar ? "حالة المنتج وخارطة الطريق" : "Product status & roadmap"}
        </Link>
      </footer>
    </div>
  );
}
