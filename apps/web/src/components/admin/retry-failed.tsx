"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function RetryFailed({ queue, failedCount }: { queue: string; failedCount: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function run() {
    if (!window.confirm(`确认重试队列「${queue}」的 ${failedCount} 个失败任务？`)) return;
    setBusy(true);
    try {
      const res = await fetch("/api/admin/system/retry-failed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ queue }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error?.message ?? "操作失败");
      toast.success(`已重试 ${json.retried} 个任务`);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "操作失败");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button variant="outline" size="sm" disabled={busy || failedCount === 0} onClick={run}>
      重试失败
    </Button>
  );
}
