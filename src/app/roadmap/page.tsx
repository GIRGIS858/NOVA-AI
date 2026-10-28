import Link from "next/link";
import { Brand } from "@/components/brand";
import { LocaleButton } from "@/components/locale-button";
import { getLocale } from "@/lib/locale";
import { Check, CircleDashed, ArrowUpLeft } from "lucide-react";
export const metadata = { title: "Product status" };
export default async function Roadmap() {
  const locale = await getLocale();
  const ar = locale === "ar";
  const phases = ar
    ? [
        [
          "01",
          "الأساس",
          "حسابات وجلسات آمنة، مشاريع محفوظة، استوديو للملاحظات، وعربية وإنجليزية.",
          true,
        ],
        [
          "02",
          "البناء الحقيقي",
          "ربط مزوّد AI، توليد ملفات وتعديلات محددة، وتشغيل معاينة في بيئة معزولة.",
          false,
        ],
        [
          "03",
          "الإصدارات والاعتمادية",
          "سجل تغييرات، استرجاع الإصدارات، إلغاء العمليات، وضبط التزامن والموارد.",
          false,
        ],
        [
          "04",
          "الكريديت والفوترة",
          "دفتر معاملات، حجز وتسوية الاستهلاك، وخطط ودفع في وضع الاختبار أولًا.",
          false,
        ],
        [
          "05",
          "النشر والتعاون",
          "روابط عامة متحقق منها، دومينات، صلاحيات الفرق، ومراقبة وتشغيل.",
          false,
        ],
      ]
    : [
        [
          "01",
          "The foundation",
          "Accounts and secure sessions, persisted projects, a notes studio, and Arabic and English.",
          true,
        ],
        [
          "02",
          "Real building",
          "Connect an AI provider, generate focused file changes, and run an isolated preview.",
          false,
        ],
        [
          "03",
          "Versions and reliability",
          "Change history, version recovery, cancellation, concurrency, and resource limits.",
          false,
        ],
        [
          "04",
          "Credits and billing",
          "A transactional ledger, reservations and settlement, plans, and test-mode payments first.",
          false,
        ],
        [
          "05",
          "Publishing and collaboration",
          "Verified public URLs, domains, team permissions, monitoring, and operations.",
          false,
        ],
      ];
  return (
    <>
      <header className="site-header">
        <Brand />
        <LocaleButton locale={locale} />
      </header>
      <main className="roadmap-page section-shell">
        <p className="overline">NOVA / PRODUCT STATUS</p>
        <h1>
          {ar
            ? "طموح واضح. تقدم يمكنك رؤيته."
            : "Clear ambition. Visible progress."}
        </h1>
        <p className="lead muted">
          {ar
            ? "نبني منصة متكاملة، مرحلة بمرحلة. هذه الصفحة تفصل المتاح حاليًا عما لم يُنفّذ بعد."
            : "We’re building a complete platform, one usable stage at a time. Here is what’s available and what is still ahead."}
        </p>
        <div className="roadmap-list">
          {phases.map(([n, title, desc, live]) => (
            <article key={String(n)}>
              <span className="step-number">{n}</span>
              <div>
                <h2>{title}</h2>
                <p>{desc}</p>
              </div>
              <span className={`pill ${live ? "live" : ""}`}>
                {live ? <Check size={14} /> : <CircleDashed size={14} />}{" "}
                {live
                  ? ar
                    ? "متاح محليًا"
                    : "Available locally"
                  : ar
                    ? "مخطط له"
                    : "Planned"}
              </span>
            </article>
          ))}
        </div>
        <section className="status-notice" id="availability">
          <h2>
            {ar ? "قبل استخدام بيانات مهمة" : "Before using important data"}
          </h2>
          <p>
            {ar
              ? "هذه نسخة تطويرية وليست خدمة إنتاج جاهزة. لا يتوفر استرجاع كلمة المرور أو تأكيد البريد بعد. قاعدة البيانات محلية؛ لا توجد فرق مشتركة أو مدفوعات أو توليد AI مفعّل. لا تدخل أسرارًا في وصف المشروع."
              : "This is a development release, not a production-ready service. Password recovery and email verification are not available yet. Storage is local. Shared teams, payments, and AI generation are not enabled. Do not put secrets in project briefs."}
          </p>
        </section>
        <Link className="button dark" href="/app">
          {ar ? "جرّب مساحة العمل" : "Try the workspace"}
          <ArrowUpLeft size={17} />
        </Link>
      </main>
    </>
  );
}
