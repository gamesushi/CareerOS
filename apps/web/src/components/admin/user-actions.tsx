"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

const ROLES = ["guest", "user", "recruiter", "admin", "enterprise"] as const;

type Body =
  | { action: "set_role"; role: string; reason?: string }
  | { action: "soft_delete" | "restore" | "ban" | "unban"; reason?: string };

export function UserActions({
  userId,
  role,
  isDeleted,
  isBanned,
}: {
  userId: string;
  role: string;
  isDeleted: boolean;
  isBanned: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function run(body: Body, confirmMsg?: string) {
    if (confirmMsg && !window.confirm(confirmMsg)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/users/${userId}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error?.message ?? "操作失败");
      toast.success("操作成功");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "操作失败");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <label className="text-sm text-muted-foreground">角色</label>
        <select
          className="rounded-md border bg-background px-2 py-1 text-sm"
          defaultValue={role}
          disabled={busy}
          onChange={(e) => {
            const next = e.target.value;
            if (next === role) return;
            void run({ action: "set_role", role: next }, `确认把角色改为「${next}」？`);
          }}
        >
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-wrap gap-2">
        {isBanned ? (
          <Button variant="outline" size="sm" disabled={busy} onClick={() => run({ action: "unban" }, "确认解封该用户？")}>
            解封
          </Button>
        ) : (
          <Button variant="outline" size="sm" disabled={busy} onClick={() => run({ action: "ban" }, "确认封禁该用户？封禁后立即无法登录。")}>
            封禁
          </Button>
        )}
        {isDeleted ? (
          <Button variant="outline" size="sm" disabled={busy} onClick={() => run({ action: "restore" }, "确认恢复该用户？")}>
            恢复
          </Button>
        ) : (
          <Button variant="destructive" size="sm" disabled={busy} onClick={() => run({ action: "soft_delete" }, "确认软删除该用户？可恢复。")}>
            软删除
          </Button>
        )}
      </div>
    </div>
  );
}
