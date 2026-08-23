"use client";

import { Suspense, useEffect, useState } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useT } from "@/lib/i18n/provider";
import { LocaleSwitcher } from "@/components/locale-switcher";

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" className="mr-2">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1Z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38Z"
      />
    </svg>
  );
}

function LoginForm({
  passwordEnabled,
  otpEnabled,
  googleEnabled,
  devEnabled,
}: {
  passwordEnabled: boolean;
  otpEnabled: boolean;
  googleEnabled: boolean;
  devEnabled: boolean;
}) {
  const t = useT();
  const params = useSearchParams();
  const callbackUrl = params.get("callbackUrl") ?? "/dashboard";
  const errorParam = params.get("error");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [tosChecked, setTosChecked] = useState(false);
  const [loading, setLoading] = useState(false);

  // 登录方式切换：密码 / 验证码。密码始终可用；验证码仅在 otpEnabled 时出现。
  const [mode, setMode] = useState<"password" | "otp">("password");
  const [otpCode, setOtpCode] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otpSending, setOtpSending] = useState(false);
  const [otpCooldown, setOtpCooldown] = useState(0);
  const [otpMsg, setOtpMsg] = useState("");
  const [otpDevCode, setOtpDevCode] = useState("");

  // dev 邮箱直登
  const [devEmail, setDevEmail] = useState("");
  const [devTos, setDevTos] = useState(false);
  const [devLoading, setDevLoading] = useState(false);

  // 验证码发送冷却倒计时
  useEffect(() => {
    if (otpCooldown <= 0) return;
    const id = setTimeout(() => setOtpCooldown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [otpCooldown]);

  async function handleSendCode() {
    if (!email.includes("@") || otpCooldown > 0) return;
    setOtpSending(true);
    setOtpMsg("");
    setOtpDevCode("");
    try {
      const res = await fetch("/api/v1/auth/request-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setOtpMsg(data?.message || t("login.error"));
      } else {
        setOtpSent(true);
        setOtpCooldown(60);
        if (data?.devCode) setOtpDevCode(data.devCode);
      }
    } catch {
      setOtpMsg(t("login.error"));
    } finally {
      setOtpSending(false);
    }
  }

  async function handleOtpLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!tosChecked || !otpSent) return;
    setLoading(true);
    await signIn("email-otp", { email, code: otpCode, tosAccepted: "true", callbackUrl });
    setLoading(false);
  }

  function showError() {
    if (!errorParam) return;
    if (errorParam === "CredentialsSignin") return t("login.wrongCredentials");
    return t("login.error");
  }
  const authError = showError();

  async function handlePasswordLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!tosChecked) return;
    setLoading(true);
    // 失败会重定向到 /login?error=CredentialsSignin，由页面顶部展示；成功则跳 callbackUrl。
    await signIn("credentials", { email, password, tosAccepted: "true", callbackUrl });
    setLoading(false);
  }

  async function handleDevLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!devTos) return;
    setDevLoading(true);
    await signIn("dev", { email: devEmail, tosAccepted: "true", callbackUrl });
    setDevLoading(false);
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1.5">
            <img src="/logo.png" alt={t("app.name")} className="h-10 w-auto mb-1" />
            <CardDescription>{t("login.description")}</CardDescription>
          </div>
          <LocaleSwitcher className="w-auto shrink-0" />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {googleEnabled && (
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => signIn("google", { callbackUrl })}
          >
            <GoogleIcon />
            {t("login.googleSignin")}
          </Button>
        )}

        {(googleEnabled && (passwordEnabled || otpEnabled || devEnabled)) && (
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" />
            <span>{t("login.or")}</span>
            <span className="h-px flex-1 bg-border" />
          </div>
        )}

        {(passwordEnabled || otpEnabled) && (
          <div className="space-y-3">
            {otpEnabled && (
              <div className="flex items-center gap-1 rounded-lg bg-muted p-1 text-xs">
                <button
                  type="button"
                  onClick={() => setMode("password")}
                  className={`flex-1 rounded-md px-3 py-1.5 font-medium transition ${
                    mode === "password" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
                  }`}
                >
                  {t("login.passwordMode")}
                </button>
                <button
                  type="button"
                  onClick={() => setMode("otp")}
                  className={`flex-1 rounded-md px-3 py-1.5 font-medium transition ${
                    mode === "otp" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
                  }`}
                >
                  {t("login.otpMode")}
                </button>
              </div>
            )}

            {mode === "password" && passwordEnabled && (
              <form onSubmit={handlePasswordLogin} className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="email">{t("login.email")}</Label>
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
                  <Label htmlFor="password">{t("login.password")}</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder={t("login.passwordPlaceholder")}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
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
                {authError && <p className="text-xs text-destructive">{authError}</p>}
                <Button type="submit" className="w-full" disabled={loading || !tosChecked}>
                  {loading ? t("login.loading") : t("login.submit")}
                </Button>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">
                    {t("login.noAccount")}{" "}
                    <Link href="/register" className="text-foreground underline underline-offset-2">
                      {t("login.registerLink")}
                    </Link>
                  </span>
                  <Link
                    href="/forgot-password"
                    className="text-foreground underline underline-offset-2"
                  >
                    {t("login.forgot")}
                  </Link>
                </div>
              </form>
            )}

            {mode === "otp" && otpEnabled && (
              <form onSubmit={handleOtpLogin} className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="otp-email">{t("login.email")}</Label>
                  <Input
                    id="otp-email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="otp-code">{t("login.otpCode")}</Label>
                  <div className="flex gap-2">
                    <Input
                      id="otp-code"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      placeholder={t("login.otpCodePlaceholder")}
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value)}
                      required
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleSendCode}
                      disabled={otpSending || otpCooldown > 0 || !email.includes("@")}
                      className="shrink-0"
                    >
                      {otpCooldown > 0 ? `${otpCooldown}s` : otpSending ? t("login.sending") : t("login.sendCode")}
                    </Button>
                  </div>
                  {otpMsg && <p className="text-xs text-destructive">{otpMsg}</p>}
                  {otpDevCode && (
                    <p className="text-xs text-muted-foreground">
                      {t("login.devCodePrefix")}<span className="font-mono font-semibold text-foreground">{otpDevCode}</span>
                    </p>
                  )}
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
                {authError && <p className="text-xs text-destructive">{authError}</p>}
                <Button type="submit" className="w-full" disabled={loading || !tosChecked || !otpSent}>
                  {loading ? t("login.loading") : t("login.submit")}
                </Button>
                <div className="text-xs">
                  <span className="text-muted-foreground">
                    {t("login.noAccount")}{" "}
                    <Link href="/register" className="text-foreground underline underline-offset-2">
                      {t("login.registerLink")}
                    </Link>
                  </span>
                </div>
              </form>
            )}
          </div>
        )}

        {devEnabled && (
          <>
            {passwordEnabled && (
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="h-px flex-1 bg-border" />
                <span>{t("login.devMode")}</span>
                <span className="h-px flex-1 bg-border" />
              </div>
            )}
            <form onSubmit={handleDevLogin} className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="dev-email">{t("login.email")}</Label>
                <Input
                  id="dev-email"
                  type="email"
                  placeholder="you@example.com"
                  value={devEmail}
                  onChange={(e) => setDevEmail(e.target.value)}
                  required
                />
              </div>
              <label className="flex cursor-pointer items-start gap-2 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  className="mt-0.5 size-3.5 shrink-0 accent-primary"
                  checked={devTos}
                  onChange={(e) => setDevTos(e.target.checked)}
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
              <Button type="submit" variant="secondary" className="w-full" disabled={devLoading || !devTos}>
                {devLoading ? t("login.loading") : t("login.devSignin")}
              </Button>
              <p className="text-xs text-muted-foreground">{t("login.devHint")}</p>
            </form>
          </>
        )}

        {!googleEnabled && !passwordEnabled && !otpEnabled && !devEnabled && (
          <p className="text-xs text-muted-foreground">
            {t("login.noAuthHint")}
          </p>
        )}

        <div className="text-center text-xs">
          <Link
            href="/welcome"
            className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            {t("login.learnMore")} →
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

export default function LoginFormWrapper({
  passwordEnabled,
  otpEnabled,
  googleEnabled,
  devEnabled,
}: {
  passwordEnabled: boolean;
  otpEnabled: boolean;
  googleEnabled: boolean;
  devEnabled: boolean;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <Suspense>
        <LoginForm
          passwordEnabled={passwordEnabled}
          otpEnabled={otpEnabled}
          googleEnabled={googleEnabled}
          devEnabled={devEnabled}
        />
      </Suspense>
    </main>
  );
}
