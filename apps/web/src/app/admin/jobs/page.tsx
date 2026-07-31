import Link from "next/link";
import { listDiscoveredJobs, listSourceHealth, type JobState } from "@/lib/admin/jobs";
import { int } from "@/lib/admin/format";
import { JobTakedown } from "@/components/admin/job-takedown";

export const dynamic = "force-dynamic";

const STATES: JobState[] = ["all", "active", "takendown"];

export default async function AdminJobsPage({
  searchParams,
}: {
  searchParams: Promise<{ source?: string; q?: string; state?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const state = (STATES.includes(sp.state as JobState) ? sp.state : "all") as JobState;
  const page = Math.max(1, Number(sp.page) || 1);
  const [{ rows, total, pageSize }, sources] = await Promise.all([
    listDiscoveredJobs({ source: sp.source, q: sp.q, state, page }),
    listSourceHealth(),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">内容运营</h1>
        <p className="mt-1 text-sm text-muted-foreground">审核抓取岗位、下架诈骗/幽灵岗（按 source+externalId 跨所有用户生效）。</p>
      </header>

      <section className="space-y-2">
        <h2 className="text-sm font-medium text-muted-foreground">抓取源健康</h2>
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
              <tr><th className="px-4 py-2 font-medium">来源</th><th className="px-4 py-2 font-medium tabular-nums">岗位数</th><th className="px-4 py-2 font-medium tabular-nums">已下架</th></tr>
            </thead>
            <tbody>
              {sources.length === 0 && <tr><td colSpan={3} className="px-4 py-4 text-center text-muted-foreground">暂无数据</td></tr>}
              {sources.map((s) => (
                <tr key={s.source} className="border-t">
                  <td className="px-4 py-2 font-mono text-xs">
                    <Link href={`?source=${encodeURIComponent(s.source)}`} className="text-primary hover:underline">{s.source}</Link>
                  </td>
                  <td className="px-4 py-2 tabular-nums">{int(s.total)}</td>
                  <td className={`px-4 py-2 tabular-nums ${s.takenDown > 0 ? "text-destructive" : "text-muted-foreground"}`}>{int(s.takenDown)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-muted-foreground">岗位（共 {int(total)}）</h2>
          <form className="flex items-center gap-2" method="get">
            {sp.source && <input type="hidden" name="source" value={sp.source} />}
            <input name="q" defaultValue={sp.q ?? ""} placeholder="标题/公司" className="w-40 rounded-md border bg-background px-2 py-1 text-sm" />
            <select name="state" defaultValue={state} className="rounded-md border bg-background px-2 py-1 text-sm">
              <option value="all">全部</option>
              <option value="active">未下架</option>
              <option value="takendown">已下架</option>
            </select>
            <button type="submit" className="rounded-md border bg-background px-3 py-1 text-sm hover:bg-accent">筛选</button>
          </form>
        </div>
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">岗位</th>
                <th className="px-3 py-2 font-medium">来源</th>
                <th className="px-3 py-2 font-medium">状态</th>
                <th className="px-3 py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && <tr><td colSpan={4} className="px-3 py-6 text-center text-muted-foreground">无匹配岗位</td></tr>}
              {rows.map((j) => (
                <tr key={j.id} className="border-t align-top">
                  <td className="px-3 py-2">
                    <a href={j.url} target="_blank" rel="noreferrer" className="text-primary hover:underline">{j.title}</a>
                    <div className="text-xs text-muted-foreground">{j.company ?? "—"}{j.location ? ` · ${j.location}` : ""}</div>
                  </td>
                  <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{j.source}</td>
                  <td className="px-3 py-2">
                    {j.takenDownAt
                      ? <span className="rounded bg-destructive/10 px-1.5 py-0.5 text-[11px] text-destructive">已下架</span>
                      : <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">{j.status}</span>}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <JobTakedown source={j.source} externalId={j.externalId} isTakenDown={!!j.takenDownAt} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">第 {page} / {totalPages} 页</span>
          <div className="flex gap-2">
            {page > 1 && <Link href={`?${new URLSearchParams({ ...(sp.source ? { source: sp.source } : {}), ...(sp.q ? { q: sp.q } : {}), state, page: String(page - 1) })}`} className="rounded-md border px-3 py-1 hover:bg-accent">上一页</Link>}
            {page < totalPages && <Link href={`?${new URLSearchParams({ ...(sp.source ? { source: sp.source } : {}), ...(sp.q ? { q: sp.q } : {}), state, page: String(page + 1) })}`} className="rounded-md border px-3 py-1 hover:bg-accent">下一页</Link>}
          </div>
        </div>
      </section>
    </div>
  );
}
