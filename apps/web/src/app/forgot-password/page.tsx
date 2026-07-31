"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useT } from "@/lib/i18n/provider";
import { LocaleSwitcher } from "@/components/locale-switcher";

export default function ForgotPasswordPage() {
  const t = useT();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [devResetUrl, setDevResetUrl] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/v1/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error?.message ?? t("common.unknownError"));
        setLoading(false);
        return;
      }
      setSent(true);
      if (data.devResetUrl) setDevResetUrl(data.devResetUrl);
    } catch {
      setError(t("common.unknownError"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <div className="flex items-start justify-between gap-2">
            <div className="space-y-1.5">
              <CardTitle className="text-2xl">{t("forgot.title")}</CardTitle>
              <CardDescription>{t("forgot.description")}</CardDescription>
            </div>
            <LocaleSwitcher className="w-auto shrink-0" />
          </div>
        </CardHeader>
        <CardContent>
          {sent ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">{t("forgot.sent")}</p>
              {devResetUrl && (
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">{t("forgot.devHint")}</p>
                  <Link
                    href={devResetUrl}
                    className="break-all text-xs text-primary underline underline-offset-2"
                  >
                    {devResetUrl}
                  </Link>
                </div>
              )}
              <Button asChild variant="outline" className="w-full">
                <Link href="/login">{t("forgot.backToLogin")}</Link>
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="email">{t("forgot.email")}</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              {error && <p className="text-xs text-destructive">{error}</p>}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? t("forgot.loading") : t("forgot.submit")}
              </Button>
              <p className="text-center text-xs">
                <Link
                  href="/login"
                  className="text-muted-foreground underline underline-offset-4 hover:text-foreground hover:underline"
                >
                  {t("forgot.backToLogin")}
                </Link>
              </p>
            </form>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
