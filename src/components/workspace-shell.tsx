import Link from "next/link";
import { House, FolderOpen, Map, CircleHelp, ArrowUpRight } from "lucide-react";
import { LocaleButton } from "./locale-button";
import type { Locale } from "@/lib/locale";
export function WorkspaceShell({
  children,
  locale,
  active = "home",
}: {
  children: React.ReactNode;
  locale: Locale;
  active?: "home" | "projects";
}) {
  const ar = locale === "ar";
  const navigation = [
    { href: "/", icon: House, label: ar ? "الرئيسية" : "Home", key: "home" },
    {
      href: "/app",
      icon: FolderOpen,
      label: ar ? "مشاريعي" : "My projects",
      key: "projects",
    },
    {
      href: "/roadmap",
      icon: Map,
      label: ar ? "خارطة الطريق" : "Roadmap",
      key: "roadmap",
    },
  ];
  return (
    <div className="nova-stage">
      <div className="nova-window">
        <a className="skip-link" href="#workspace-content">
          {ar ? "انتقل إلى المحتوى" : "Skip to content"}
        </a>
        <aside
          className="nova-rail"
          aria-label={ar ? "تنقل مساحة العمل" : "Workspace navigation"}
        >
          <Link href="/" className="rail-logo" aria-label="Nova home">
            N<span>✦</span>
          </Link>
          <nav className="rail-nav">
            {navigation.map((item) => (
              <Link
                key={item.key}
                href={item.href}
                className={`rail-link ${item.key === active ? "is-active" : ""}`}
                aria-label={item.label}
                title={item.label}
                aria-current={item.key === active ? "page" : undefined}
              >
                <item.icon size={18} strokeWidth={1.7} />
                <span className="rail-tooltip">{item.label}</span>
              </Link>
            ))}
          </nav>
          <div className="rail-bottom">
            <Link
              className="rail-link"
              href="/roadmap#availability"
              aria-label={
                ar ? "المساعدة وحالة المنتج" : "Help and product status"
              }
            >
              <CircleHelp size={18} />
            </Link>
            <Link
              href="/app"
              className="rail-profile"
              aria-label={ar ? "افتح حسابك" : "Open your account"}
            >
              <span>N</span>
              <ArrowUpRight size={10} />
            </Link>
          </div>
        </aside>
        <div className="nova-content" id="workspace-content">
          <div className="window-topline">
            <span className="window-label">
              NOVA <span>/</span> {ar ? "مساحة الإبداع" : "CREATIVE WORKSPACE"}
            </span>
            <LocaleButton locale={locale} />
          </div>
          {children}
        </div>
      </div>
      <div className="stage-caption">
        <span>MADE FOR WHAT’S NEXT</span>
        <span>NOVA · FOUNDATION 01</span>
      </div>
    </div>
  );
}
