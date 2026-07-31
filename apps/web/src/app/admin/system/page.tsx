import { getSystemHealth } from "@/lib/admin/system";
import { getAlertConfig } from "@/lib/admin/alerts";
import { int } from "@/lib/admin/format";
import { RetryFailed } from "@/components/admin/retry-failed";
import { AlertConfig } from "@/components/admin/alert-config";

export const dynamic = "force-dynamic";

export default async function AdminSystemPage() {
  const [h, alertCfg] = await Promise.all([getSystemHealth(), getAlertConfig()]);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">系统健康</h1>
        <p className="mt-1 text-sm text-muted-foreground">BullMQ 队列状态、失败任务重试、embedding/迁移概况（实时）。</p>
      </header>

      <section className="space-y-2">
        <h2 className="text-sm font-medium text-muted-foreground">队列（BullMQ）</h2>
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">队列</th>
                <th className="px-4 py-2 font-medium tabular-nums">waiting</th>
                <th className="px-4 py-2 font-medium tabular-nums">active</th>
                <th className="px-4 py-2 font-medium tabular-nums">delayed</th>
                <th className="px-4 py-2 font-medium tabular-nums">failed</th>
                <th className="px-4 py-2 font-medium tabular-nums">completed</th>
                <th className="px-4 py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {h.queues.map((q) => (
                <tr key={q.name} className="border-t">
                  <td className="px-4 py-2 font-mono">
                    {q.name}
                    {!q.ok && <span className="ml-2 rounded bg-destructive/10 px-1.5 py-0.5 text-[10px] text-destructive">读取失败</span>}
                  </td>
                  <td className="px-4 py-2 tabular-nums">{int(q.waiting)}</td>
                  <td className="px-4 py-2 tabular-nums">{int(q.active)}</td>
                  <td className="px-4 py-2 tabular-nums">{int(q.delayed)}</td>
                  <td className={`px-4 py-2 tabular-nums ${q.failed > 0 ? "font-medium text-destructive" : ""}`}>{int(q.failed)}</td>
                  <td className="px-4 py-2 tabular-nums text-muted-foreground">{int(q.completed)}</td>
                  <td className="px-4 py-2 text-right"><RetryFailed queue={q.name} failedCount={q.failed} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-medium text-muted-foreground">成本告警</h2>
        <AlertConfig config={alertCfg} />
      </section>

      <section className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs text-muted-foreground">Embedding 记录数</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{int(h.embeddings)}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs text-muted-foreground">已应用迁移数</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{int(h.migrations)}</p>
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-medium text-muted-foreground">最近失败任务（ai 队列）</h2>
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">任务</th>
                <th className="px-3 py-2 font-medium tabular-nums">尝试</th>
                <th className="px-3 py-2 font-medium">失败原因</th>
                <th className="px-3 py-2 font-medium">时间</th>
              </tr>
            </thead>
            <tbody>
              {h.failed.length === 0 && <tr><td colSpan={4} className="px-3 py-6 text-center text-muted-foreground">无失败任务</td></tr>}
              {h.failed.map((j) => (
                <tr key={j.id} className="border-t align-top">
                  <td className="px-3 py-2 font-mono text-xs">{j.name}<span className="text-muted-foreground">#{j.id}</span></td>
                  <td className="px-3 py-2 tabular-nums">{j.attemptsMade}</td>
                  <td className="px-3 py-2 font-mono text-[11px] text-destructive">{j.failedReason || "—"}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{j.timestamp.slice(0, 16).replace("T", " ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
