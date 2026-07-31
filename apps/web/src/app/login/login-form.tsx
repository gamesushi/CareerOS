"use client";

import { Suspense, useState } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
  googleEnabled,
  devEnabled,
}: {
  passwordEnabled: boolean;
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

  // dev 邮箱直登
  const [devEmail, setDevEmail] = useState("");
  const [devTos, setDevTos] = useState(false);
  const [devLoading, setDevLoading] = useState(false);

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
            <CardTitle className="text-2xl">{t("app.name")}</CardTitle>
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
            Continue with Google
          </Button>
        )}

        {(googleEnabled && (passwordEnabled || devEnabled)) && (
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" />
            <span>或</span>
            <span className="h-px flex-1 bg-border" />
          </div>
        )}

        {passwordEnabled && (
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

        {devEnabled && (
          <>
            {passwordEnabled && (
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="h-px flex-1 bg-border" />
                <span>开发模式</span>
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

        {!googleEnabled && !passwordEnabled && !devEnabled && (
          <p className="text-xs text-muted-foreground">
            登录方式未启用，请检查认证配置（AUTH_GOOGLE_ID / AUTH_DEV_CREDENTIALS）。
          </p>
        )}

        <div className="text-center text-xs">
          <Link
            href="/welcome"
            className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            了解 CareerOS 产品 →
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

export default function LoginFormWrapper({
  passwordEnabled,
  googleEnabled,
  devEnabled,
}: {
  passwordEnabled: boolean;
  googleEnabled: boolean;
  devEnabled: boolean;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <Suspense>
        <LoginForm
          passwordEnabled={passwordEnabled}
          googleEnabled={googleEnabled}
          devEnabled={devEnabled}
        />
      </Suspense>
    </main>
  );
}
