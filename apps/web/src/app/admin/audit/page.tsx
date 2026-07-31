import Link from "next/link";
import { listAuditLogs } from "@/lib/admin/audit";
import { maskEmail } from "@/lib/admin/mask";
import { int } from "@/lib/admin/format";
import type { AdminAction } from "@careeros/db";

export const dynamic = "force-dynamic";

const ACTIONS: AdminAction[] = ["user_role_change", "user_soft_delete", "user_restore", "user_ban", "job_takedown", "source_toggle", "other"];

export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: Promise<{ action?: string; actor?: string; target?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const action = ACTIONS.includes(sp.action as AdminAction) ? (sp.action as AdminAction) : undefined;
  const page = Math.max(1, Number(sp.page) || 1);
  const { rows, total, pageSize } = await listAuditLogs({ action, actorId: sp.actor, targetId: sp.target, page });
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">审计</h1>
        <p className="mt-1 text-sm text-muted-foreground">共 {int(total)} 条。所有管理写操作留痕，只增不改不删。</p>
      </header>

      <form className="flex flex-wrap items-center gap-2" method="get">
        <select name="action" defaultValue={action ?? ""} className="rounded-md border bg-background px-2 py-1.5 text-sm">
          <option value="">全部动作</option>
          {ACTIONS.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <button type="submit" className="rounded-md border bg-background px-3 py-1.5 text-sm hover:bg-accent">筛选</button>
      </form>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">时间</th>
              <th className="px-3 py-2 font-medium">操作人</th>
              <th className="px-3 py-2 font-medium">动作</th>
              <th className="px-3 py-2 font-medium">目标</th>
              <th className="px-3 py-2 font-medium">变更</th>
              <th className="px-3 py-2 font-medium">原因</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">暂无审计记录</td></tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className="border-t align-top">
                <td className="px-3 py-2 text-xs text-muted-foreground">{r.createdAt.toISOString().slice(0, 16).replace("T", " ")}</td>
                <td className="px-3 py-2 font-mono text-xs">{r.actor ? maskEmail(r.actor.email) : "—"}</td>
                <td className="px-3 py-2"><span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px]">{r.action}</span></td>
                <td className="px-3 py-2 font-mono text-[11px] text-muted-foreground">{r.targetType}{r.targetId ? `:${r.targetId.slice(0, 8)}` : ""}</td>
                <td className="px-3 py-2 font-mono text-[11px] text-muted-foreground">
                  {r.before ? <div>← {JSON.stringify(r.before)}</div> : null}
                  {r.after ? <div>→ {JSON.stringify(r.after)}</div> : null}
                </td>
                <td className="px-3 py-2 text-xs text-muted-foreground">{r.reason ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">第 {page} / {totalPages} 页</span>
        <div className="flex gap-2">
          {page > 1 && <Link href={`?${new URLSearchParams({ ...(action ? { action } : {}), page: String(page - 1) })}`} className="rounded-md border px-3 py-1 hover:bg-accent">上一页</Link>}
          {page < totalPages && <Link href={`?${new URLSearchParams({ ...(action ? { action } : {}), page: String(page + 1) })}`} className="rounded-md border px-3 py-1 hover:bg-accent">下一页</Link>}
        </div>
      </div>
    </div>
  );
}
