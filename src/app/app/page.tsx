import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Plus,
  ArrowUpLeft,
  FolderOpen,
  LayoutGrid,
  ArrowUpRight,
  Sparkles,
} from "lucide-react";
import { session } from "@/lib/auth";
import { getLocale } from "@/lib/locale";
import { projects } from "@/lib/db";
import { createProject } from "@/app/actions";
import { BriefInput } from "@/components/brief-input";
export const metadata = { title: "Workspace" };
export default async function Dashboard({
  searchParams,
}: {
  searchParams: Promise<{ error?: string | string[] }>;
}) {
  const q = await searchParams;
  const locale = await getLocale();
  const ar = locale === "ar";
  const current = await session();
  if (!current) redirect("/login?next=%2Fapp");
  const items = projects.list(current.user.id);
  return (
    <main className="dashboard section-shell">
      <div className="dashboard-title">
        <div>
          <p className="overline">
            {ar
              ? `مرحبًا، ${current.user.name}`
              : `WELCOME BACK, ${current.user.name}`}
          </p>
          <h1>{ar ? "مساحة لأفكارك القادمة." : "A space for what’s next."}</h1>
          <p className="muted">
            {ar
              ? "مشاريعك، تفاصيلك، وخطوتك التالية. كلها هنا."
              : "Your projects, your details, your next move. All together."}
          </p>
        </div>
        <a className="button primary" href="#new-project">
          <Plus size={17} />
          {ar ? "مشروع جديد" : "New project"}
        </a>
      </div>
      <section className="new-project-card" id="new-project">
        <div className="new-project-intro">
          <span className="icon-tile">
            <Sparkles size={24} />
          </span>
          <h2>{ar ? "على ماذا سنعمل؟" : "What’s on your mind?"}</h2>
          <p>
            {ar
              ? "ابدأ باسم ووصف واضح. سنحفظهما كأساس لمشروعك."
              : "Start with a name and a clear brief. We’ll save them as your project’s foundation."}
          </p>
          <span className="pill">
            {ar
              ? "حفظ حقيقي · دون استهلاك كريديت"
              : "Real persistence · No credits charged"}
          </span>
        </div>
        <form action={createProject} className="project-form">
          <label>
            {ar ? "اسم المشروع" : "Project name"}
            <input
              name="name"
              required
              minLength={2}
              maxLength={80}
              placeholder={ar ? "مثلًا: استوديو مدى" : "e.g. Forma Studio"}
            />
          </label>
          <label>
            {ar ? "الفكرة والأهداف" : "Your idea and goals"}
            <BriefInput ar={ar} />
          </label>
          {q.error && (
            <p role="alert" className="form-error">
              {ar
                ? "أدخل اسمًا من حرفين ووصفًا من 10 أحرف على الأقل."
                : "Use a name of at least 2 characters and a brief of at least 10 characters."}
            </p>
          )}
          <button className="button dark" type="submit">
            {ar ? "أنشئ المشروع" : "Create project"}
            <ArrowUpLeft size={16} />
          </button>
        </form>
      </section>
      <section className="project-section">
        <div className="section-heading">
          <h2>
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
