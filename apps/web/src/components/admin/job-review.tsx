"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

/** 审核队列的通过/拒绝操作（拒绝时可填理由）。 */
export function JobReview({ id, reviewStatus }: { id: string; reviewStatus: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function run(decision: "approved" | "rejected") {
    let note: string | undefined;
    if (decision === "rejected") {
      const v = window.prompt("拒绝理由（可选，将展示给提交者）：");
      if (v === null) return; // 用户取消
      note = v.trim() || undefined;
    } else if (reviewStatus === "rejected") {
      if (!window.confirm("该岗位此前已被拒绝，确认改为通过？")) return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/admin/jobs/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, decision, note }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error?.message ?? "操作失败");
      toast.success(decision === "approved" ? "已通过，岗位进入总库" : "已拒绝");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "操作失败");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex gap-1.5">
      {reviewStatus !== "approved" && (
        <Button size="sm" disabled={busy} onClick={() => run("approved")}>通过</Button>
      )}
      {reviewStatus !== "rejected" && (
        <Button size="sm" variant="destructive" disabled={busy} onClick={() => run("rejected")}>拒绝</Button>
      )}
    </div>
  );
}
