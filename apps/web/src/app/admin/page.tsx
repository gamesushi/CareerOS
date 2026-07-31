import Link from "next/link";
import { getOverviewMetrics } from "@/lib/admin/metrics";
import { usd, int, pct } from "@/lib/admin/format";

// 指标实时（含 Redis 队列计数），禁用静态化。
export const dynamic = "force-dynamic";

function Stat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "warn" }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`mt-1 text-2xl font-semibold tabular-nums ${tone === "warn" ? "text-destructive" : ""}`}>{value}</p>
      {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

export default async function AdminOverviewPage() {
  const m = await getOverviewMetrics();

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">概览</h1>
        <p className="mt-1 text-sm text-muted-foreground">全局健康快照（实时）。角色以数据库为准，仅管理员可达。</p>
      </header>

      <section className="space-y-2">
        <h2 className="text-sm font-medium text-muted-foreground">用户</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="用户总数" value={int(m.users.total)} />
          <Stat label="管理员" value={int(m.users.admins)} />
          <Stat label="近 7 天新增" value={int(m.users.new7d)} />
          <Stat label="已软删" value={int(m.users.softDeleted)} />
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-medium text-muted-foreground">
          AI 成本 · <Link href="/admin/usage" className="text-primary hover:underline">明细 →</Link>
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="今日成本" value={usd(m.cost.today)} sub={`${int(m.cost.runsToday)} 次调用`} />
          <Stat label="本月成本" value={usd(m.cost.month)} />
          <Stat
            label="24h 失败率"
            value={pct(m.reliability.failureRate)}
            sub={`${int(m.reliability.last24hFailed)}/${int(m.reliability.last24hTotal)} 失败`}
            tone={m.reliability.failureRate > 0.1 ? "warn" : undefined}
          />
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-medium text-muted-foreground">队列积压（BullMQ）</h2>
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">队列</th>
                <th className="px-4 py-2 font-medium tabular-nums">waiting</th>
                <th className="px-4 py-2 font-medium tabular-nums">active</th>
                <th className="px-4 py-2 font-medium tabular-nums">delayed</th>
                <th className="px-4 py-2 font-medium tabular-nums">failed</th>
              </tr>
            </thead>
            <tbody>
              {m.queues.map((q) => (
                <tr key={q.name} className="border-t">
                  <td className="px-4 py-2 font-mono">
                    {q.name}
                    {!q.ok && <span className="ml-2 rounded bg-destructive/10 px-1.5 py-0.5 text-[10px] text-destructive">读取失败</span>}
                  </td>
                  <td className="px-4 py-2 tabular-nums">{int(q.waiting)}</td>
                  <td className="px-4 py-2 tabular-nums">{int(q.active)}</td>
                  <td className="px-4 py-2 tabular-nums">{int(q.delayed)}</td>
                  <td className={`px-4 py-2 tabular-nums ${q.failed > 0 ? "font-medium text-destructive" : ""}`}>{int(q.failed)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
