"use client";

import { signOut } from "next-auth/react";
import { useT } from "@/lib/i18n/provider";
import { Button } from "@/components/ui/button";

// 账号被封禁时的全屏提示（由 (app)/layout 在 bannedAt 命中时渲染，替代进 UI 壳但 API 全 403 的不一致）。
export function BannedScreen({ email, bannedAt }: { email: string; bannedAt: Date }) {
  const t = useT();
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-md rounded-lg border border-destructive/40 bg-destructive/5 p-6 text-center">
        <h1 className="text-lg font-semibold text-destructive">{t("banned.title")}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{t("banned.desc")}</p>
        <p className="mt-2 text-xs text-muted-foreground">
          {t("banned.account")}：{email}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {t("banned.since")}：{new Date(bannedAt).toLocaleString("zh-CN")}
        </p>
        <div className="mt-5">
          <Button variant="outline" size="sm" onClick={() => signOut({ callbackUrl: "/login" })}>
            {t("app.logout")}
          </Button>
        </div>
      </div>
    </div>
  );
}
