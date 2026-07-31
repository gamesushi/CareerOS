"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";
import { useT } from "@/lib/i18n/provider";
import { Button } from "@/components/ui/button";

// 账号危险操作区：自助注销。二次确认后调用 /api/v1/account/delete，成功后清除会话。
export function AccountDanger() {
  const t = useT();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function doDelete() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/account/delete", { method: "POST" });
      if (!res.ok) throw new Error("delete_failed");
      // 注销成功后由客户端清除会话 cookie 并跳回登录页
      await signOut({ callbackUrl: "/login" });
    } catch {
      setBusy(false);
      setError(t("settings.deleteError"));
    }
  }

  return (
    <section className="rounded-lg border border-destructive/40 p-4">
      <h2 className="text-sm font-medium text-destructive">{t("settings.dangerZone")}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{t("settings.deleteDesc")}</p>
      <div className="mt-3">
        {!confirming ? (
          <Button variant="destructive" size="sm" onClick={() => setConfirming(true)}>
            {t("settings.deleteAccount")}
          </Button>
        ) : (
          <div className="space-y-3 rounded-md bg-destructive/5 p-3">
            <p className="text-sm text-foreground">{t("settings.deleteWarning")}</p>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex gap-2">
              <Button variant="destructive" size="sm" onClick={doDelete} disabled={busy}>
                {busy ? t("settings.deleting") : t("settings.confirmDelete")}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setConfirming(false)} disabled={busy}>
                {t("settings.cancel")}
              </Button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
