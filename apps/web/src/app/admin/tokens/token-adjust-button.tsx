"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { api } from "@/lib/client";

// 管理员调节某用户 token 余额：发放（grant）或扣减（deduct）。
export function TokenAdjustButton({
  userId,
  email,
  currentBalance,
}: {
  userId: string;
  email: string;
  currentBalance: number | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [action, setAction] = useState<"grant" | "deduct">("grant");
  const [amount, setAmount] = useState(10000);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (amount <= 0) {
      toast.error("金额必须大于 0");
      return;
    }
    setBusy(true);
    const r = await api("/admin/tokens/adjust", {
      method: "POST",
      body: JSON.stringify({ userId, action, amount: Math.floor(amount), note: note || undefined }),
    });
    setBusy(false);
    if (r) {
      toast.success(
        `${action === "grant" ? "发放" : "扣减"} ${Math.floor(amount).toLocaleString()}，当前余额 ${r.balance.toLocaleString()}`,
      );
      setOpen(false);
      setNote("");
      router.refresh();
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md border px-2.5 py-1 text-xs hover:bg-accent"
      >
        调节
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-1.5 rounded-md border bg-muted/30 p-2">
      <p className="text-[11px] text-muted-foreground">{email}</p>
      <div className="flex items-center gap-1.5">
        <select
          value={action}
          onChange={(e) => setAction(e.target.value as "grant" | "deduct")}
          className="rounded border bg-background px-1.5 py-1 text-xs"
        >
          <option value="grant">发放</option>
          <option value="deduct">扣减</option>
        </select>
        <input
          type="number"
          min={1}
          value={amount}
          onChange={(e) => setAmount(Number(e.target.value))}
          className="w-24 rounded border bg-background px-1.5 py-1 text-xs tabular-nums"
        />
      </div>
      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="备注（可选）"
        className="rounded border bg-background px-1.5 py-1 text-xs"
      />
      <div className="flex gap-1.5">
        <button
          type="button"
          onClick={submit}
          disabled={busy}
          className="rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground disabled:opacity-50"
        >
          {busy ? "处理中…" : "确定"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-md border px-2.5 py-1 text-xs hover:bg-accent"
        >
          取消
        </button>
      </div>
      {currentBalance != null && (
        <p className="text-[11px] text-muted-foreground">当前余额 {currentBalance.toLocaleString()}</p>
      )}
    </div>
  );
}
