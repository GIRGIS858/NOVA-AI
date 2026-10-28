import { LocaleButton } from "@/components/locale-button";
import { SignOut } from "@/components/sign-out";
import { WorkspaceNav } from "@/components/workspace-nav";
import { getLocale } from "@/lib/locale";
import Link from "next/link";
import "./workspace.css";
import "./generation.css";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ar = (await getLocale()) === "ar";
  return (
    <div className="app-shell nova-workspace">
      <a className="workspace-skip" href="#workspace-content">
        {ar ? "انتقل للمحتوى" : "Skip to content"}
      </a>
      <WorkspaceNav ar={ar} />
      <div className="workspace-frame">
        <header className="workspace-header">
          <Link
            href="/app"
            className="workspace-wordmark"
            aria-label={ar ? "نوفا — مساحة العمل" : "Nova workspace"}
          >
            <span dir="ltr">
              nova<span>.</span>
            </span>
            <span className="workspace-header-label">
              {ar ? "مساحة العمل" : "Workspace"}
            </span>
          </Link>
          <div className="header-actions">
            <LocaleButton locale={ar ? "ar" : "en"} />
            <SignOut ar={ar} />
          </div>
        </header>
        <div id="workspace-content" tabIndex={-1}>
          {children}
        </div>
      </div>
    </div>
  );
}
