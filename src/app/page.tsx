import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { getLocale } from "@/lib/locale";
import { WorkspaceShell } from "@/components/workspace-shell";
import { NovaOrb } from "@/components/nova-orb";
import { IdeaComposer } from "@/components/idea-composer";
export default async function Home() {
  const locale = await getLocale();
  const ar = locale === "ar";
  return (
    <WorkspaceShell locale={locale}>
      <main className="creation-home">
        <NovaOrb />
        <div className="creation-heading">
          <p className="creation-greeting">
            {ar ? "مرحبًا بك في Nova" : "Hello, dreamer."}
          </p>
          <h1>
            {ar ? "كيف نساعد فكرتك اليوم؟" : "What will you create today?"}
          </h1>
          <p className="creation-subtitle">
            {ar ? (
              <>
                من أول فكرة، إلى شيء يستحق أن يُبنى.
                <br />
                مساحتك للتفكير والتصميم والخطوة القادمة.
              </>
            ) : (
              <>
                From a spark of an idea to something worth building.
                <br />
                Your space to imagine, design, and take the next step.
              </>
            )}
          </p>
        </div>
        <IdeaComposer locale={locale} />
        <Link className="home-roadmap" href="/roadmap">
          {ar
            ? "نصنع Nova خطوة بخطوة. تابع ما نبنيه."
            : "Building Nova, one thoughtful step at a time."}
          <ArrowUpRight size={13} />
        </Link>
      </main>
    </WorkspaceShell>
  );
}
