"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useT } from "@/lib/i18n/provider";
import { LocaleSwitcher } from "@/components/locale-switcher";

function VerifyForm() {
  const t = useT();
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get("token") ?? "";
  // 无 token 的错误态从初始 state 决定，避免在 effect 里同步 setState（React 反模式）。
  const [status, setStatus] = useState<"loading" | "success" | "error">(token ? "loading" : "error");
  const [error, setError] = useState(token ? "" : t("verify.invalid"));

  useEffect(() => {
    if (!token) return;
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/v1/auth/verify-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          if (active) {
            setStatus("error");
            setError(data?.error?.message ?? t("verify.invalid"));
          }
        } else if (active) {
          setStatus("success");
        }
      } catch {
        if (active) {
          setStatus("error");
          setError(t("verify.invalid"));
        }
      }
    })();
    return () => {
      active = false;
    };
  }, [token, t]);

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1.5">
            <CardTitle className="text-2xl">{t("verify.title")}</CardTitle>
            <CardDescription>{t("verify.description")}</CardDescription>
          </div>
          <LocaleSwitcher className="w-auto shrink-0" />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {status === "loading" && (
          <p className="text-sm text-muted-foreground">{t("verify.description")}</p>
        )}
        {status === "success" && (
          <>
            <p className="text-sm text-muted-foreground">{t("verify.success")}</p>
            <Button
              className="w-full"
              onClick={async () => {
                await signOut({ redirect: false });
                router.push("/login");
              }}
            >
              {t("verify.goLogin")}
            </Button>
          </>
        )}
        {status === "error" && (
          <>
            <p className="text-sm text-destructive">{error}</p>
            <Button asChild className="w-full">
              <Link href="/login">{t("verify.goLogin")}</Link>
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default function VerifyEmailPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <Suspense
        fallback={
          <Card className="w-full max-w-sm">
            <CardContent className="p-6 text-sm text-muted-foreground">…</CardContent>
          </Card>
        }
      >
        <VerifyForm />
      </Suspense>
    </main>
  );
}
