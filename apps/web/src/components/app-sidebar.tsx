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
  ListChecks,
  Building2,
  Store,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n/provider";
import { LocaleSwitcher } from "@/components/locale-switcher";

type NavItem = {
  href: string;
  key: string;
  icon: React.ComponentType<{ className?: string }>;
};

type NavGroup = {
  labelKey: string;
  items: readonly NavItem[];
};

const NAV_GROUPS: readonly NavGroup[] = [
  {
    labelKey: "nav.group.career",
    items: [
      { href: "/knowledge", key: "nav.knowledge", icon: Library },
      { href: "/skills", key: "nav.skills", icon: Sparkles },
      { href: "/worklogs", key: "nav.worklogs", icon: NotebookPen },
      { href: "/imports", key: "nav.imports", icon: FileUp },
    ],
  },
  {
    labelKey: "nav.group.jobs",
    items: [
      { href: "/jobs", key: "nav.jobs", icon: Target },
      { href: "/jobs/active", key: "nav.activeJobs", icon: ListChecks },
      { href: "/monitor", key: "nav.monitor", icon: Radar },
      { href: "/applications", key: "nav.applications", icon: KanbanSquare },
      { href: "/insights", key: "nav.insights", icon: BarChart3 },
    ],
  },
  {
    labelKey: "nav.group.docs",
    items: [
      { href: "/resumes", key: "nav.resumes", icon: FileText },
      { href: "/writing", key: "nav.writing", icon: PenLine },
      { href: "/negotiation", key: "nav.negotiation", icon: Handshake },
    ],
  },
] as const;

const PERSONAL_ITEMS: readonly NavItem[] = [
  { href: "/profile", key: "nav.profile", icon: User },
  { href: "/settings", key: "nav.settings", icon: Settings },
];

// 招聘者专属入口，仅 isRecruiter 时渲染
const EMPLOYER_ITEMS: readonly NavItem[] = [
  { href: "/employer/jobs", key: "nav.employerJobs", icon: Building2 },
  { href: "/employer/company", key: "nav.employerCompany", icon: Store },
];

const TOP_ITEMS: readonly NavItem[] = [
  { href: "/dashboard", key: "nav.dashboard", icon: LayoutDashboard },
];

// 精确判定导航高亮：「岗位匹配」(/jobs) 与「在招岗位」(/jobs/active) 是平级兄弟，
// 在 /jobs/active 时不该高亮 /jobs；但 /jobs 在 /jobs/[id] 等子页仍应高亮。
function isNavActive(href: string, pathname: string): boolean {
  if (pathname === href) return true;
  if (!pathname.startsWith(href + "/")) return false;
  if (href === "/jobs" && pathname.startsWith("/jobs/active")) return false;
  return true;
}

export function AppSidebar({
  userName,
  userEmail,
  isAdmin = false,
  isRecruiter = false,
  userPhoto,
}: {
  userName: string;
  userEmail: string;
  isAdmin?: boolean;
  /** 可发岗角色（recruiter/enterprise/admin）。由 layout 查 DB 得出，不读 JWT。 */
  isRecruiter?: boolean;
  userPhoto?: string | null;
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
      <nav className="flex-1 overflow-y-auto px-3 pb-2">
        <div className="space-y-0.5 pb-3">
          {TOP_ITEMS.map(({ href, key, icon: Icon }) => {
            const active = isNavActive(href, pathname);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors",
                  active
                    ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                    : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground",
                )}
              >
                <Icon className="size-4" />
                <span className="flex-1 truncate">{t(key)}</span>
              </Link>
            );
          })}
        </div>
        {NAV_GROUPS.map((group, gi) => (
          <div key={group.labelKey} className={gi === 0 ? "" : "mt-4"}>
            <p className="px-2.5 mb-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">
              {t(group.labelKey)}
            </p>
            <div className="space-y-0.5">
              {group.items.map(({ href, key, icon: Icon }) => {
                const active = isNavActive(href, pathname);
                return (
                  <Link
                    key={href}
                    href={href}
                    className={cn(
                      "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors",
                      active
                        ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                        : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground",
                    )}
                  >
                    <Icon className="size-4" />
                    <span className="flex-1 truncate">{t(key)}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
        {isRecruiter && (
          <div className="mt-4">
            <p className="px-2.5 mb-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">
              {t("nav.group.employer")}
            </p>
            <div className="space-y-0.5">
              {EMPLOYER_ITEMS.map(({ href, key, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors",
                    isNavActive(href, pathname)
                      ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                      : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground",
                  )}
                >
                  <Icon className="size-4" />
                  <span className="flex-1 truncate">{t(key)}</span>
                </Link>
              ))}
            </div>
          </div>
        )}
        <div className="mt-4 border-t pt-3">
          {PERSONAL_ITEMS.map(({ href, key, icon: Icon }) => {
            const active = isNavActive(href, pathname);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors",
                  active
                    ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                    : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground",
                )}
              >
                <Icon className="size-4" />
                <span className="flex-1 truncate">{t(key)}</span>
              </Link>
            );
          })}
          {isAdmin && (
            <Link
              href="/admin"
              className={cn(
                "mt-0.5 flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors",
                pathname.startsWith("/admin")
                  ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                  : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground",
              )}
            >
              <ShieldCheck className="size-4" />
              <span className="flex-1 truncate">{t("nav.admin")}</span>
            </Link>
          )}
        </div>
      </nav>
      <div className="border-t p-3 space-y-2">
        <LocaleSwitcher className="w-full" />
        <div className="flex items-center gap-2 px-1.5">
          {userPhoto ? (
            <img
              src={userPhoto}
              alt={displayName}
              className="size-8 shrink-0 rounded-full object-cover"
            />
          ) : (
            <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">
              {displayName.slice(0, 1).toUpperCase()}
            </div>
          )}
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