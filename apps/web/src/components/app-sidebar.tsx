"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  LayoutDashboard,
  Library,
  Sparkles,
  NotebookPen,
  Target,
  FileText,
  FileUp,
  Settings,
  LogOut,
  Radar,
  User,
  ShieldCheck,
  KanbanSquare,
  PenLine,
  Handshake,
  BarChart3,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n/provider";
import { LocaleSwitcher } from "@/components/locale-switcher";

const NAV = [
  { href: "/dashboard", key: "nav.dashboard", icon: LayoutDashboard },
  { href: "/knowledge", key: "nav.knowledge", icon: Library },
  { href: "/imports", key: "nav.imports", icon: FileUp },
  { href: "/skills", key: "nav.skills", icon: Sparkles },
  { href: "/worklogs", key: "nav.worklogs", icon: NotebookPen },
  { href: "/jobs", key: "nav.jobs", icon: Target },
  { href: "/monitor", key: "nav.monitor", icon: Radar },
  { href: "/applications", key: "nav.applications", icon: KanbanSquare },
  { href: "/insights", key: "nav.insights", icon: BarChart3 },
  { href: "/resumes", key: "nav.resumes", icon: FileText },
  { href: "/writing", key: "nav.writing", icon: PenLine },
  { href: "/negotiation", key: "nav.negotiation", icon: Handshake },
  { href: "/profile", key: "nav.profile", icon: User },
  { href: "/settings", key: "nav.settings", icon: Settings },
] as const;

export function AppSidebar({
  userName,
  userEmail,
  isAdmin = false,
}: {
  userName: string;
  userEmail: string;
  isAdmin?: boolean;
}) {
  const pathname = usePathname();
  const t = useT();
  const displayName = userName || t("app.defaultUser");
  return (
    <aside className="flex w-60 shrink-0 flex-col border-r bg-sidebar">
      <div className="px-5 py-5">
        <Link href="/dashboard" className="text-lg font-semibold tracking-tight">
          {t("app.name")}
        </Link>
        <p className="mt-0.5 text-xs text-muted-foreground">{t("app.tagline")}</p>
      </div>
      <nav className="flex-1 space-y-0.5 px-3">
        {NAV.map(({ href, key, icon: Icon }) => {
          const active = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors",
                active
                  ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                  : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground",
              )}
            >
              <Icon className="size-4" />
              <span className="flex-1">{t(key)}</span>
            </Link>
          );
        })}
        {isAdmin && (
          <Link
            href="/admin"
            className={cn(
              "mt-1 flex items-center gap-2.5 rounded-md border-t px-2.5 py-2 pt-3 text-sm transition-colors",
              pathname.startsWith("/admin")
                ? "font-medium text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <ShieldCheck className="size-4" />
            <span className="flex-1">管理后台</span>
          </Link>
        )}
      </nav>
      <div className="border-t p-3 space-y-2">
        <LocaleSwitcher className="w-full" />
        <div className="flex items-center gap-2 px-1.5">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">
            {displayName.slice(0, 1).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{displayName}</p>
            <p className="truncate text-xs text-muted-foreground">{userEmail}</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            title={t("app.logout")}
            onClick={() => signOut({ callbackUrl: "/login" })}
          >
            <LogOut className="size-4" />
          </Button>
        </div>
      </div>
    </aside>
  );
}
