"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function JobTakedown({ source, externalId, isTakenDown }: { source: string; externalId: string; isTakenDown: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function run() {
    const restore = isTakenDown;
    const msg = restore ? "确认恢复该岗位（所有用户）？" : "确认下架该岗位？将从所有用户 feed 移除。";
    if (!window.confirm(msg)) return;
    setBusy(true);
    try {
      const res = await fetch("/api/admin/jobs/takedown", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source, externalId, restore }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error?.message ?? "操作失败");
      toast.success(`${restore ? "已恢复" : "已下架"}（影响 ${json.affected} 条）`);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "操作失败");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button variant={isTakenDown ? "outline" : "destructive"} size="sm" disabled={busy} onClick={run}>
      {isTakenDown ? "恢复" : "下架"}
    </Button>
  );
}
