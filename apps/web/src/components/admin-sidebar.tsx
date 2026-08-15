"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  DollarSign,
  ClipboardCheck,
  Server,
  ScrollText,
  ToggleRight,
  ArrowLeft,
  ShieldCheck,
  Inbox,
  Building2,
} from "lucide-react";
import { cn } from "@/lib/utils";

// P0-1 只落「概览」入口；其余模块占位为「开发中」，随 P0/P1 逐步接入真实页面。
const NAV = [
  { href: "/admin", label: "概览", icon: LayoutDashboard, live: true },
  { href: "/admin/users", label: "用户", icon: Users, live: true },
  { href: "/admin/usage", label: "AI 成本", icon: DollarSign, live: true },
  { href: "/admin/jobs", label: "内容运营", icon: ClipboardCheck, live: true },
  { href: "/admin/review", label: "录入审核", icon: Inbox, live: true },
  { href: "/admin/postings", label: "企业发布审核", icon: Building2, live: true },
  { href: "/admin/system", label: "系统健康", icon: Server, live: true },
  { href: "/admin/flags", label: "灰度开关", icon: ToggleRight, live: true },
  { href: "/admin/audit", label: "审计", icon: ScrollText, live: true },
] as const;

export function AdminSidebar({ userEmail }: { userEmail: string }) {
  const pathname = usePathname();
  return (
    <aside className="flex w-60 shrink-0 flex-col border-r bg-sidebar">
      <div className="px-5 py-5">
        <Link href="/admin" className="flex items-center gap-2 text-lg font-semibold tracking-tight">
          <ShieldCheck className="size-5 text-primary" />
          管理后台
        </Link>
        <p className="mt-0.5 text-xs text-muted-foreground">uCareerOS Admin</p>
      </div>
      <nav className="flex-1 space-y-0.5 px-3">
        {NAV.map(({ href, label, icon: Icon, live }) => {
          const active = href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
          if (!live) {
            return (
              <div
                key={href}
                className="flex cursor-not-allowed items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-muted-foreground/50"
                title="开发中"
              >
                <Icon className="size-4" />
                <span className="flex-1">{label}</span>
                <span className="rounded bg-muted px-1.5 py-0.5 text-[10px]">开发中</span>
              </div>
            );
          }
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
              <span className="flex-1">{label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="border-t p-3">
        <Link
          href="/dashboard"
          className="flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-muted-foreground transition-colors hover:bg-sidebar-accent/60 hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          <span className="flex-1">返回应用</span>
        </Link>
        <p className="truncate px-2.5 pt-2 text-xs text-muted-foreground">{userEmail}</p>
      </div>
    </aside>
  );
}
