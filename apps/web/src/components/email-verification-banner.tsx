"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n/provider";

// 未验证邮箱时的顶部提示条：展示提醒并提供「重新发送验证邮件」。
// emailVerified 由服务端布局从 DB 取权威值传入，验证后下次导航即消失。
export function EmailVerificationBanner({
  email,
  emailVerified,
}: {
  email: string;
  emailVerified: Date | null | undefined;
}) {
  const t = useT();
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  if (emailVerified) return null;

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
    <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
      <div className="flex items-center justify-between gap-3">
        <span>{t("verify.banner")}</span>
        <Button
          size="sm"
          variant="outline"
          onClick={resend}
          disabled={loading || sent}
          className="shrink-0"
        >
          {sent ? t("verify.bannerSent") : loading ? t("register.loading") : t("verify.bannerResend")}
        </Button>
      </div>
      {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
    </div>
  );
}
