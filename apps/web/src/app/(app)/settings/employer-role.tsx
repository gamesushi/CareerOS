"use client";

// 自助开启/关闭发岗能力（user ↔ recruiter）。
// 切换后不需要重新登录：导航与接口门禁都查 DB，router.refresh() 即可让侧栏出现「发布岗位」。

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { api } from "@/lib/client";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n/provider";

export function EmployerRole({ role }: { role: string }) {
  const t = useT();
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  // admin / enterprise 由管理员设定，不提供自助切换（避免管理员误把自己降权）
  const locked = role !== "user" && role !== "recruiter";
  const isRecruiter = role === "recruiter";

  async function toggle() {
    setBusy(true);
    const res = await api<{ role: string }>("/me/role", {
      method: "PUT",
      body: JSON.stringify({ role: isRecruiter ? "user" : "recruiter" }),
    });
    setBusy(false);
    if (res) {
      toast.success(isRecruiter ? t("settings.employerOff") : t("settings.employerOn"));
      router.refresh();
    }
  }

  return (
    <section>
      <h2 className="mb-2 text-sm font-medium text-muted-foreground">
        {t("settings.employerTitle")}
      </h2>
      <p className="mb-3 text-sm text-muted-foreground">
        {locked ? t("settings.employerLocked", { role }) : t("settings.employerDesc")}
      </p>
      {!locked && (
        <Button variant={isRecruiter ? "outline" : "default"} disabled={busy} onClick={toggle}>
          {isRecruiter ? t("settings.employerDisable") : t("settings.employerEnable")}
        </Button>
      )}
    </section>
  );
}
