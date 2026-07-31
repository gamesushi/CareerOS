"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n/provider";

/**
 * 条款重确认闸门（阻断式弹窗）。
 * 由 (app)/layout 在服务端判断 user.tosVersion !== CURRENT_TOS_VERSION 时渲染：
 * 覆盖老用户、条款版本更新、以及未经登录页勾选建立的会话（如 OAuth / 脚本直登）。
 * 不同意则只能退出登录——不给「稍后再说」，否则留痕就失去意义。
 */
export function TosGate({ isUpdate }: { isUpdate: boolean }) {
  const t = useT();
  const router = useRouter();
  const [checked, setChecked] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function accept() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/tos/accept", { method: "POST" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      router.refresh();
    } catch {
      setError(t("tos.error"));
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl border bg-background p-6 shadow-lg">
        <h2 className="text-lg font-semibold">
          {isUpdate ? t("tos.updateTitle") : t("tos.title")}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {isUpdate ? t("tos.updateDesc") : t("tos.desc")}
        </p>
        <label className="mt-4 flex cursor-pointer items-start gap-2 text-sm">
          <input
            type="checkbox"
            className="mt-0.5 size-4 shrink-0 accent-primary"
            checked={checked}
            onChange={(e) => setChecked(e.target.checked)}
          />
          <span>
            {t("login.tosPrefix")}
            <Link href="/terms" target="_blank" className="underline underline-offset-2">
              {t("login.tosTerms")}
            </Link>
            {t("login.tosAnd")}
            <Link href="/privacy" target="_blank" className="underline underline-offset-2">
              {t("login.tosPrivacy")}
            </Link>
          </span>
        </label>
        {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
        <div className="mt-5 flex items-center justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => signOut({ callbackUrl: "/login" })}>
            {t("tos.decline")}
          </Button>
          <Button size="sm" disabled={!checked || loading} onClick={accept}>
            {loading ? t("tos.accepting") : t("tos.accept")}
          </Button>
        </div>
      </div>
    </div>
  );
}
