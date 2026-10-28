"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Sparkles, LayoutGrid, Plus, Map, ArrowUpRight } from "lucide-react";

export function WorkspaceNav({ ar }: { ar: boolean }) {
  const pathname = usePathname();
  return (
    <aside className="workspace-rail">
      <Link
        href="/"
        className="rail-brand"
        aria-label={ar ? "نوفا — الرئيسية" : "Nova home"}
        title={ar ? "الرئيسية" : "Home"}
      >
        <Sparkles size={25} aria-hidden="true" />
      </Link>
      <nav aria-label={ar ? "التنقل في مساحة العمل" : "Workspace navigation"}>
        <Link
          href="/app"
          className={`rail-link ${pathname === "/app" ? "active" : ""}`}
          aria-current={pathname === "/app" ? "page" : undefined}
          title={ar ? "مساحة العمل" : "Workspace"}
        >
          <LayoutGrid size={20} aria-hidden="true" />
          <span className="sr-only">{ar ? "مساحة العمل" : "Workspace"}</span>
        </Link>
        <Link
          href="/app#new-project"
          className="rail-link"
          title={ar ? "مشروع جديد" : "New project"}
        >
          <Plus size={21} aria-hidden="true" />
          <span className="sr-only">{ar ? "مشروع جديد" : "New project"}</span>
        </Link>
        <Link
          href="/app#projects"
          className="rail-link"
          title={ar ? "كل المشاريع" : "All projects"}
        >
          <ArrowUpRight size={21} aria-hidden="true" />
          <span className="sr-only">{ar ? "كل المشاريع" : "All projects"}</span>
        </Link>
      </nav>
      <Link
        href="/roadmap"
        className="rail-link rail-bottom"
        title={ar ? "خطة التطوير" : "Roadmap"}
      >
        <Map size={20} aria-hidden="true" />
        <span className="sr-only">{ar ? "خطة التطوير" : "Roadmap"}</span>
      </Link>
    </aside>
  );
}
