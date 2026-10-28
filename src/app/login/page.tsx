import { Brand } from "@/components/brand";
import { LocaleButton } from "@/components/locale-button";
import { AuthForm } from "@/components/auth-form";
import { getLocale } from "@/lib/locale";
import { session } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Layers3, Check } from "lucide-react";
export const metadata = { title: "Welcome" };
export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const locale = await getLocale();
  const ar = locale === "ar";
  const q = await searchParams;
  const requestedNext = typeof q.next === "string" ? q.next : undefined;
  const next =
    requestedNext &&
    (requestedNext === "/app" ||
      requestedNext.startsWith("/app?") ||
      requestedNext.startsWith("/app/")) &&
    !requestedNext.includes("\\")
      ? requestedNext
      : "/app";
  if (await session()) redirect(next);
  return (
    <main className="auth-page">
      <header className="site-header">
        <Brand />
        <LocaleButton locale={locale} />
      </header>
      <div className="auth-grid">
        <aside className="auth-story">
          <span className="overline">YOUR NEXT CHAPTER</span>
          <h1>
            {ar ? (
              <>
                كل فكرة كبيرة
                <br />
                تبدأ <em>بخطوة.</em>
              </>
            ) : (
              <>
                Every big idea
                <br />
                starts <em>somewhere.</em>
              </>
            )}
          </h1>
          <p>
            {ar
              ? "مساحة خاصة لمشاريعك. بداية واضحة، وتفاصيل محفوظة، ومجال لكل ما هو قادم."
              : "A home for your projects. A clear beginning, details that stay with you, and room for what comes next."}
          </p>
          <div className="story-art">
            <Layers3 size={90} strokeWidth={0.8} />
            <span>nova / workspace</span>
          </div>
          <div className="story-note">
            <Check size={17} />
            {ar
              ? "حساب مجاني · لا تحتاج بطاقة دفع"
              : "Free account · No credit card required"}
          </div>
        </aside>
        <section className="auth-card">
          <span className="pill live">
            {ar ? "مرحبًا بك في Nova" : "WELCOME TO NOVA"}
          </span>
          <h2>{ar ? "مساحتك تبدأ هنا." : "Make yourself at home."}</h2>
          <p className="muted">
            {ar
              ? "احفظ أفكارك، وارجع لتكملها متى شئت."
              : "Save your ideas. Pick up where you left off."}
          </p>
          <AuthForm locale={locale} next={next} />
        </section>
      </div>
    </main>
  );
}
