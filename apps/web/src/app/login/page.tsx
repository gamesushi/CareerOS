"use client";

import { Suspense, useState } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function LoginForm() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const params = useSearchParams();
  const callbackUrl = params.get("callbackUrl") ?? "/dashboard";

  async function handleDevLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    await signIn("dev", { email, callbackUrl });
    setLoading(false);
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle className="text-2xl">CareerOS</CardTitle>
        <CardDescription>职业操作系统 · 让职业经历成为长期数字资产</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={handleDevLogin} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="email">邮箱</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "登录中…" : "登录 / 注册"}
          </Button>
        </form>
        <p className="text-xs text-muted-foreground">
          开发模式：输入邮箱即登录。生产环境将替换为邮件验证链接与 Google 登录。
        </p>
      </CardContent>
    </Card>
  );
}

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <Suspense>
        <LoginForm />
      </Suspense>
    </main>
  );
}
