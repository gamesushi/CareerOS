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
  Settings,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const NAV = [
  { href: "/dashboard", label: "总览", icon: LayoutDashboard },
  { href: "/knowledge", label: "职业知识库", icon: Library },
  { href: "/skills", label: "技能中心", icon: Sparkles },
  { href: "/worklogs", label: "工作日志", icon: NotebookPen, soon: true },
  { href: "/jobs", label: "岗位匹配", icon: Target, soon: true },
  { href: "/resumes", label: "简历中心", icon: FileText, soon: true },
  { href: "/settings", label: "设置", icon: Settings },
];

export function AppSidebar({ userName, userEmail }: { userName: string; userEmail: string }) {
  const pathname = usePathname();
  return (
    <aside className="flex w-60 shrink-0 flex-col border-r bg-sidebar">
      <div className="px-5 py-5">
        <Link href="/dashboard" className="text-lg font-semibold tracking-tight">
          CareerOS
        </Link>
        <p className="mt-0.5 text-xs text-muted-foreground">职业操作系统</p>
      </div>
      <nav className="flex-1 space-y-0.5 px-3">
        {NAV.map(({ href, label, icon: Icon, soon }) => {
          const active = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={soon ? "#" : href}
              aria-disabled={soon}
              className={cn(
                "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors",
                active
                  ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                  : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground",
                soon && "cursor-default opacity-50 hover:bg-transparent hover:text-muted-foreground",
              )}
            >
              <Icon className="size-4" />
              <span className="flex-1">{label}</span>
              {soon && (
                <Badge variant="outline" className="px-1 py-0 text-[10px] font-normal">
                  即将上线
                </Badge>
              )}
            </Link>
          );
        })}
      </nav>
      <div className="border-t p-3">
        <div className="flex items-center gap-2 px-1.5">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">
            {userName.slice(0, 1).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{userName}</p>
            <p className="truncate text-xs text-muted-foreground">{userEmail}</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            title="退出登录"
            onClick={() => signOut({ callbackUrl: "/login" })}
          >
            <LogOut className="size-4" />
          </Button>
        </div>
      </div>
    </aside>
  );
}
