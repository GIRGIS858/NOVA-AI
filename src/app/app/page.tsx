import Link from "next/link";
import { redirect } from "next/navigation";
import { FolderOpen, LayoutGrid, ArrowUpRight } from "lucide-react";
import { session } from "@/lib/auth";
import { getLocale } from "@/lib/locale";
import { projects } from "@/lib/db";
import { ProjectComposer } from "@/components/project-composer";
export const metadata = { title: "Workspace" };
export default async function Dashboard({
  searchParams,
}: {
  searchParams: Promise<{ idea?: string; error?: string }>;
}) {
  const q = await searchParams;
  const locale = await getLocale();
  const ar = locale === "ar";
  const current = await session();
  if (!current)
    redirect(
      `/login?next=${encodeURIComponent("/app" + (q.idea ? "?idea=" + encodeURIComponent(q.idea.slice(0, 8000)) : ""))}`,
    );
  const items = projects.list(current.user.id);
  return (
    <main className="dashboard section-shell nova-dashboard">
      <section className="workspace-welcome" aria-labelledby="welcome-title">
        <div className="nova-orb" aria-hidden="true">
          <span className="nova-orb-core" />
        </div>
        <p className="overline">
          {ar
            ? `مرحبًا، ${current.user.name}`
            : `WELCOME BACK, ${current.user.name}`}
        </p>
        <h1 id="welcome-title">
          {ar ? "فكرتك القادمة تبدأ هنا." : "What will you create next?"}
        </h1>
        <p className="muted">
          {ar
            ? "مساحة هادئة لأفكار كبيرة. ابدأ بوصف ما يدور في بالك."
            : "A little space for a big idea. Start with what’s on your mind."}
        </p>
      </section>
      <ProjectComposer
        key={q.idea || ""}
        ar={ar}
        initialIdea={q.idea?.slice(0, 8000) || ""}
        hasError={Boolean(q.error)}
      />
      <section
        className="project-section"
        id="projects"
        aria-labelledby="projects-title"
      >
        <div className="section-heading">
          <h2 id="projects-title">
            <LayoutGrid size={20} />
            {ar ? "مشاريعك" : "Your projects"}
            <span className="count">{items.length}</span>
          </h2>
          <span className="muted small-text">
            {ar ? "الأحدث أولًا" : "Most recently updated"}
          </span>
        </div>
        {items.length ? (
          <div className="project-grid">
            {items.map((p, i) => (
              <Link
                href={`/app/projects/${p.id}`}
                key={p.id}
                className="project-card"
              >
                <div className={`project-cover cover-${i % 3}`}>
                  <div className="project-monogram">
                    {p.name.slice(0, 1).toUpperCase()}
                  </div>
                  <span className="pill">{ar ? "مسودة" : "Draft"}</span>
                </div>
                <div className="project-card-body">
                  <h3>
                    {p.name}
                    <ArrowUpRight size={17} />
                  </h3>
                  <p>{p.brief}</p>
                  <span className="small-text muted">
                    {new Intl.DateTimeFormat(locale, {
                      dateStyle: "medium",
                    }).format(new Date(p.updated_at))}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="empty-projects">
            <FolderOpen size={38} strokeWidth={1} />
            <h3>
              {ar
                ? "أول مشروع يبدأ بفكرة."
                : "Every project starts with an idea."}
            </h3>
            <p>
              {ar
                ? "أنشئ مشروعك من النموذج أعلاه. ستجده هنا عند العودة."
                : "Create a project above. It will be waiting here when you return."}
            </p>
          </div>
        )}
      </section>
    </main>
  );
}
