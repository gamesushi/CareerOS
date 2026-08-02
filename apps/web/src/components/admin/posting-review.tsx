"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

/** 雇主发布岗的审核（通过/拒绝）与下架/恢复操作。 */
export function PostingReview({
  id,
  reviewStatus,
  takenDown,
}: {
  id: string;
  reviewStatus: string;
  takenDown: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function post(path: string, body: unknown, okMsg: string) {
    setBusy(true);
    try {
      const res = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error?.message ?? "操作失败");
      toast.success(okMsg);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "操作失败");
    } finally {
      setBusy(false);
    }
  }

  async function review(decision: "approved" | "rejected") {
    let note: string | undefined;
    if (decision === "rejected") {
      const v = window.prompt("拒绝理由（可选，将展示给发布者）：");
      if (v === null) return;
      note = v.trim() || undefined;
    } else if (reviewStatus === "rejected") {
      if (!window.confirm("该发布此前已被拒绝，确认改为通过？")) return;
    }
    await post(
      "/api/admin/postings/review",
      { id, decision, note },
      decision === "approved" ? "已通过，岗位进入候选端" : "已拒绝",
    );
  }

  async function takedown(restore: boolean) {
    let reason: string | undefined;
    if (!restore) {
      const v = window.prompt("下架原因（可选，仅留审计）：");
      if (v === null) return;
      reason = v.trim() || undefined;
    }
    await post(
      "/api/admin/postings/takedown",
      { id, restore, reason },
      restore ? "已恢复" : "已下架",
    );
  }

  return (
    <div className="flex justify-end gap-1.5">
      {reviewStatus !== "approved" && (
        <Button size="sm" disabled={busy} onClick={() => review("approved")}>通过</Button>
      )}
      {reviewStatus !== "rejected" && (
        <Button size="sm" variant="destructive" disabled={busy} onClick={() => review("rejected")}>拒绝</Button>
      )}
      <Button size="sm" variant="outline" disabled={busy} onClick={() => takedown(takenDown)}>
        {takenDown ? "恢复" : "下架"}
      </Button>
    </div>
  );
}
