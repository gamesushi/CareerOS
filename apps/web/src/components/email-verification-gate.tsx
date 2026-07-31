"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n/provider";

// 未验证邮箱时的全屏硬拦截（由 (app)/layout 与 admin/layout 在 emailVerified 为空时渲染）。
// 与 BannedScreen 不同：这里仍可「重发验证邮件」与「退出登录」，待用户点邮件链接验证后即可进入应用。
// 拦截依据是服务端布局每次导航从 DB 取的权威 emailVerified，因此验证后下次导航即自动放行。
export function EmailVerificationGate({ email }: { email: string }) {
  const t = useT();
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function resend() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/v1/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error?.message ?? t("common.unknownError"));
      } else {
        setSent(true);
      }
    } catch {
      setError(t("common.unknownError"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div data-gate="email-verification" className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-md rounded-lg border border-amber-300 bg-amber-50 p-6 text-center dark:border-amber-800 dark:bg-amber-950">
        <h1 className="text-lg font-semibold text-amber-900 dark:text-amber-200">
          {t("verify.gateTitle")}
        </h1>
        <p className="mt-2 text-sm text-amber-800 dark:text-amber-200/90">{t("verify.gateDesc")}</p>
        <p className="mt-3 text-xs text-amber-700 dark:text-amber-300/80">
          {t("verify.gateAccount")}：{email}
        </p>
        <p className="mt-1 text-xs text-amber-700 dark:text-amber-300/80">{t("verify.gateInbox")}</p>
        <div className="mt-5 flex items-center justify-center gap-3">
          <Button onClick={resend} disabled={loading || sent}>
            {sent
              ? t("verify.bannerSent")
              : loading
                ? t("register.loading")
                : t("verify.bannerResend")}
          </Button>
          <Button variant="outline" size="sm" onClick={() => signOut({ callbackUrl: "/login" })}>
            {t("app.logout")}
          </Button>
        </div>
        {error && <p className="mt-3 text-xs text-destructive">{error}</p>}
      </div>
    </div>
  );
}
