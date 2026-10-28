import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowRight,
  MessageSquare,
  FileText,
  LockKeyhole,
  Check,
  Send,
  CircleDashed,
} from "lucide-react";
import { requireUser } from "@/lib/auth";
import { projects, generations } from "@/lib/db";
import { GenerationPanel } from "@/components/generation-panel";
import { getLocale } from "@/lib/locale";
import { saveMessage } from "@/app/actions";
import { DeleteProject } from "@/components/delete-project";
export const metadata = { title: "Project studio" };
export default async function Studio({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const q = await searchParams;
  const locale = await getLocale();
  const ar = locale === "ar";
  const project = projects.get(user.id, id);
  if (!project) notFound();
  const messages = projects.messages(user.id, id);
  return (
    <main className="studio">
      <div className="studio-toolbar">
        <div className="header-actions">
          <Link className="button ghost small" href="/app">
            <ArrowRight size={17} />
            {ar ? "المشاريع" : "Projects"}
          </Link>
          <span className="header-divider" />
          <h1>{project.name}</h1>
          <span className="pill">{ar ? "مسودة" : "Draft"}</span>
        </div>
        <span className="saved-state">
          <Check size={14} />
          {ar ? "محفوظ في قاعدة البيانات" : "Saved to database"}
        </span>
      </div>
      <div className="studio-grid">
        <section className="conversation-panel">
          <div className="panel-heading">
            <MessageSquare size={17} />
            <h2>{ar ? "تفاصيل المشروع" : "Project conversation"}</h2>
            <span className="pill">{ar ? "مرحلة التأسيس" : "Foundation"}</span>
          </div>
          <div className="conversation-feed">
            <article className="brief-message">
              <span className="overline">
                {ar ? "الفكرة الأساسية" : "PROJECT BRIEF"}
              </span>
              <p>{project.brief}</p>
            </article>
            <div className="system-note">
              <CircleDashed size={17} />
              <p>
                {ar
                  ? "احفظ متطلباتك وملاحظاتك هنا. الحفظ لا يستدعي الذكاء الاصطناعي؛ تُرسل التفاصيل للمزوّد فقط عند اختيار توليد نسخة جديدة."
                  : "Capture your requirements and notes here. Saving a note does not call AI. Details are sent to the provider only when you choose to generate a new version."}
              </p>
            </div>
            {messages.map((m) => (
              <article key={m.id} className="user-message">
                <span className="small-text muted">
                  {ar ? "ملاحظة محفوظة" : "Saved note"} ·{" "}
                  {new Intl.DateTimeFormat(locale, {
                    hour: "numeric",
                    minute: "2-digit",
                  }).format(new Date(m.created_at))}
                </span>
                <p>{m.content}</p>
              </article>
            ))}
          </div>
          <form action={saveMessage.bind(null, id)} className="studio-composer">
            <label htmlFor="message">
              {ar ? "أضف تفاصيل إلى المشروع" : "Add to your project brief"}
            </label>
            <textarea
              id="message"
              name="message"
              required
              maxLength={8000}
              placeholder={
                ar
                  ? "الألوان، الصفحات، الجمهور، أو أي تفاصيل مهمة…"
                  : "Colors, pages, audience, or anything that matters…"
              }
            />
            {q.error && (
              <p className="form-error" role="alert">
                {ar
                  ? "أدخل ملاحظة بين 1 و8000 حرف."
                  : "Enter a note between 1 and 8,000 characters."}
              </p>
            )}
            <div className="composer-bottom">
              <span className="small-text muted">
                <LockKeyhole size={13} />
                {ar ? "خاص بحسابك" : "Private to your account"}
              </span>
              <button className="button primary small">
                <Send size={14} />
                {ar ? "احفظ الملاحظة" : "Save note"}
              </button>
            </div>
          </form>
        </section>
        <section className="workspace-panel">
          <div className="panel-heading">
            <FileText size={17} />
            <h2>{ar ? "مخطط المشروع" : "Project outline"}</h2>
            <span className="small-text muted">01 / FOUNDATION</span>
          </div>
          <div className="outline-content">
            <div className="outline-title">
              <span className="icon-tile">
                <FileText size={25} />
              </span>
              <p className="overline">PROJECT / {id.slice(0, 8)}</p>
              <h2>{project.name}</h2>
              <p className="muted">
                {ar
                  ? "الفكرة محفوظة. هذه نقطة البداية لما ستبنيه."
                  : "Your idea is saved. This is where the next chapter begins."}
              </p>
            </div>
            <section className="outline-brief">
              <h3>{ar ? "الوصف الأساسي" : "The brief"}</h3>
              <p>{project.brief}</p>
            </section>
            <GenerationPanel
              key={id}
              projectId={id}
              ar={ar}
              configured={Boolean(process.env.NOVA_AI_API_KEY)}
              initialRuns={generations.runs(user.id, id)}
              initialVersions={generations.versions(user.id, id)}
            />
            <div className="project-details">
              <span>{ar ? "آخر تحديث" : "Last updated"}</span>
              <time dateTime={project.updated_at}>
                {new Intl.DateTimeFormat(locale, {
                  dateStyle: "medium",
                  timeStyle: "short",
                }).format(new Date(project.updated_at))}
              </time>
            </div>
            <DeleteProject id={id} ar={ar} />
          </div>
        </section>
      </div>
    </main>
  );
}
