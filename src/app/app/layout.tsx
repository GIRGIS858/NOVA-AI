import { WorkspaceShell } from "@/components/workspace-shell";
import { SignOut } from "@/components/sign-out";
import { getLocale } from "@/lib/locale";
import Link from "next/link";
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await getLocale();
  const ar = locale === "ar";
  return (
    <WorkspaceShell locale={locale} active="projects">
      <div className="app-shell">
        <header className="site-header app-header">
          <div className="header-actions">
            <Link href="/app" className="workspace-link">
              {ar ? "مساحة العمل" : "Workspace"}
            </Link>
          </div>
          <div className="header-actions">
            <Link className="roadmap-link" href="/roadmap">
              {ar ? "حالة المنتج" : "Product status"}
            </Link>
            <SignOut ar={ar} />
          </div>
        </header>
        {children}
      </div>
    </WorkspaceShell>
  );
}
