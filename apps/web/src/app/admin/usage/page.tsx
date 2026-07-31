import { getUsageMetrics, type UsageGroupRow } from "@/lib/admin/metrics";
import { usd, int, pct } from "@/lib/admin/format";

export const dynamic = "force-dynamic";

function GroupTable({ title, rows }: { title: string; rows: UsageGroupRow[] }) {
  const maxCost = Math.max(...rows.map((r) => r.cost), 0.0000001);
  return (
    <div className="space-y-2">
      <h2 className="text-sm font-medium text-muted-foreground">{title}</h2>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-2 font-medium">名称</th>
              <th className="px-4 py-2 font-medium tabular-nums">调用</th>
              <th className="px-4 py-2 font-medium tabular-nums">成本</th>
              <th className="px-4 py-2 font-medium tabular-nums">tokens(in/out)</th>
              <th className="px-4 py-2 font-medium tabular-nums">均延迟</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">暂无数据</td></tr>
            )}
            {rows.map((r) => (
              <tr key={r.key} className="border-t">
                <td className="px-4 py-2">
                  <div className="font-mono text-xs">{r.key}</div>
                  <div className="mt-1 h-1 w-full max-w-[160px] rounded bg-muted">
                    <div className="h-1 rounded bg-primary" style={{ width: `${(r.cost / maxCost) * 100}%` }} />
                  </div>
                </td>
                <td className="px-4 py-2 tabular-nums">{int(r.runs)}</td>
                <td className="px-4 py-2 tabular-nums">{usd(r.cost)}</td>
                <td className="px-4 py-2 tabular-nums text-xs text-muted-foreground">{int(r.tokensIn)} / {int(r.tokensOut)}</td>
                <td className="px-4 py-2 tabular-nums">{int(r.avgLatencyMs)} ms</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default async function AdminUsagePage() {
  const m = await getUsageMetrics(30);
  const maxTrend = Math.max(...m.trend.map((t) => t.cost), 0.0000001);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">AI 成本</h1>
        <p className="mt-1 text-sm text-muted-foreground">近 {m.rangeDays} 天 · 数据源 AiRun（每次 AI 调用的成本/token/延迟/状态）。</p>
      </header>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs text-muted-foreground">总成本</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{usd(m.totals.cost)}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs text-muted-foreground">总调用</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{int(m.totals.runs)}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs text-muted-foreground">失败率</p>
          <p className={`mt-1 text-2xl font-semibold tabular-nums ${m.totals.failureRate > 0.1 ? "text-destructive" : ""}`}>
            {pct(m.totals.failureRate)}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">{int(m.totals.failed)} 次失败</p>
        </div>
      </div>

      <GroupTable title="按调用类型（kind）" rows={m.byKind} />
      <GroupTable title="按模型（model）" rows={m.byModel} />

      <section className="space-y-2">
        <h2 className="text-sm font-medium text-muted-foreground">每日成本趋势</h2>
        <div className="rounded-lg border p-4">
          {m.trend.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground">暂无数据</p>
          ) : (
            <div className="space-y-1">
              {m.trend.map((t) => (
                <div key={t.day} className="flex items-center gap-2 text-xs">
                  <span className="w-20 shrink-0 tabular-nums text-muted-foreground">{t.day}</span>
                  <div className="h-3 flex-1 rounded bg-muted">
                    <div className="h-3 rounded bg-primary/70" style={{ width: `${(t.cost / maxTrend) * 100}%` }} />
                  </div>
                  <span className="w-16 shrink-0 text-right tabular-nums">{usd(t.cost)}</span>
                  <span className="w-14 shrink-0 text-right tabular-nums text-muted-foreground">{int(t.runs)} 次</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-medium text-muted-foreground">最慢请求 Top 10</h2>
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">类型</th>
                <th className="px-4 py-2 font-medium">模型</th>
                <th className="px-4 py-2 font-medium tabular-nums">延迟</th>
                <th className="px-4 py-2 font-medium tabular-nums">成本</th>
                <th className="px-4 py-2 font-medium">时间</th>
              </tr>
            </thead>
            <tbody>
              {m.slow.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">暂无数据</td></tr>
              )}
              {m.slow.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="px-4 py-2 font-mono text-xs">{r.kind}</td>
                  <td className="px-4 py-2 font-mono text-xs text-muted-foreground">{r.model ?? "—"}</td>
                  <td className="px-4 py-2 tabular-nums font-medium">{int(r.latencyMs)} ms</td>
                  <td className="px-4 py-2 tabular-nums">{usd(r.costUsd)}</td>
                  <td className="px-4 py-2 text-xs text-muted-foreground">{r.createdAt.slice(0, 16).replace("T", " ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
