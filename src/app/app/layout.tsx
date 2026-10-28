import { Brand } from "@/components/brand";
import { LocaleButton } from "@/components/locale-button";
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
    <div className="app-shell">
      <header className="site-header app-header">
        <div className="header-actions">
          <Brand />
          <span className="header-divider" />
          <Link href="/app" className="workspace-link">
            {ar ? "مساحة العمل" : "Workspace"}
          </Link>
        </div>
        <div className="header-actions">
          <Link className="roadmap-link" href="/roadmap">
            {ar ? "حالة المنتج" : "Product status"}
          </Link>
          <LocaleButton locale={locale} />
          <SignOut ar={ar} />
        </div>
      </header>
      {children}
    </div>
  );
}
