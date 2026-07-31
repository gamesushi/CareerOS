"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useT } from "@/lib/i18n/provider";
import { LocaleSwitcher } from "@/components/locale-switcher";

export default function RegisterPage() {
  const t = useT();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [tosChecked, setTosChecked] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sentEmail, setSentEmail] = useState("");
  const [devVerifyUrl, setDevVerifyUrl] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!tosChecked) return; // 未同意条款不放行（PIPL：不得默认勾选）
    if (password.length < 8) {
      setError(t("register.weakPassword"));
      return;
    }
    if (password !== confirm) {
      setError(t("register.passwordMismatch"));
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/v1/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, tosAccepted: true }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error?.message ?? t("common.unknownError"));
        setLoading(false);
        return;
      }
      // 注册成功：不自动登录，引导用户先完成邮箱验证（PIPL 邮箱确认）。
      setSentEmail(email);
      setDevVerifyUrl(data?.devVerifyUrl ?? "");
      setLoading(false);
    } catch {
      setError(t("common.unknownError"));
      setLoading(false);
    }
  }

  if (sentEmail) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle className="text-2xl">{t("register.successTitle")}</CardTitle>
            <CardDescription>{t("register.verificationSent", { email: sentEmail })}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {devVerifyUrl && (
              <p className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
                {t("register.devVerifyLink")}{" "}
                <a href={devVerifyUrl} className="text-foreground underline underline-offset-2">
                  {devVerifyUrl}
                </a>
              </p>
            )}
            <Button asChild className="w-full">
              <Link href="/login">{t("register.checkInbox")}</Link>
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <div className="flex items-start justify-between gap-2">
            <div className="space-y-1.5">
              <CardTitle className="text-2xl">{t("register.title")}</CardTitle>
              <CardDescription>{t("register.description")}</CardDescription>
            </div>
            <LocaleSwitcher className="w-auto shrink-0" />
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="email">{t("register.email")}</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">{t("register.password")}</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirm">{t("register.confirm")}</Label>
              <Input
                id="confirm"
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
              />
            </div>
            <label className="flex cursor-pointer items-start gap-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                className="mt-0.5 size-3.5 shrink-0 accent-primary"
                checked={tosChecked}
                onChange={(e) => setTosChecked(e.target.checked)}
              />
              <span>
                {t("login.tosPrefix")}
                <Link href="/terms" target="_blank" className="text-foreground underline underline-offset-2">
                  {t("login.tosTerms")}
                </Link>
                {t("login.tosAnd")}
                <Link href="/privacy" target="_blank" className="text-foreground underline underline-offset-2">
                  {t("login.tosPrivacy")}
                </Link>
              </span>
            </label>
            {error && <p className="text-xs text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading || !tosChecked}>
              {loading ? t("register.loading") : t("register.submit")}
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              {t("register.hasAccount")}{" "}
              <Link href="/login" className="text-foreground underline underline-offset-2">
                {t("register.loginLink")}
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
