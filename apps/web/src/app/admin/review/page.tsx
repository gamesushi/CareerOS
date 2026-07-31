import Link from "next/link";
import { listReviewQueue, type ReviewFilter } from "@/lib/admin/jobs";
import { int } from "@/lib/admin/format";
import { JobReview } from "@/components/admin/job-review";

export const dynamic = "force-dynamic";

const FILTERS: { key: ReviewFilter; label: string }[] = [
  { key: "pending", label: "待审核" },
  { key: "approved", label: "已通过" },
  { key: "rejected", label: "已拒绝" },
  { key: "all", label: "全部" },
];

const STATUS_BADGE: Record<string, { text: string; cls: string }> = {
  pending: { text: "待审核", cls: "bg-amber-500/10 text-amber-600" },
  approved: { text: "已通过", cls: "bg-emerald-500/10 text-emerald-600" },
  rejected: { text: "已拒绝", cls: "bg-destructive/10 text-destructive" },
};

export default async function AdminReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const filter = (FILTERS.some((f) => f.key === sp.filter) ? sp.filter : "pending") as ReviewFilter;
  const page = Math.max(1, Number(sp.page) || 1);
  const { rows, total, pageSize, pendingCount } = await listReviewQueue({ filter, page });
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">录入审核</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          审核用户手动录入 / 链接导入的岗位。待审核 <span className={pendingCount > 0 ? "font-semibold text-amber-600" : ""}>{int(pendingCount)}</span> 条；
          过审后进入公共统计与排行榜，拒绝后仅提交者本人可见被拒状态。
        </p>
      </header>

      <div className="flex items-center gap-2">
        {FILTERS.map((f) => (
          <Link
            key={f.key}
            href={`?filter=${f.key}`}
            className={`rounded-md border px-3 py-1 text-sm ${filter === f.key ? "bg-primary text-primary-foreground" : "bg-background hover:bg-accent"}`}
          >
            {f.label}
          </Link>
        ))}
        <span className="ml-auto text-sm text-muted-foreground">共 {int(total)} 条</span>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">岗位</th>
              <th className="px-3 py-2 font-medium">提交者</th>
              <th className="px-3 py-2 font-medium">方式</th>
              <th className="px-3 py-2 font-medium">状态</th>
              <th className="px-3 py-2 font-medium">提交时间</th>
              <th className="px-3 py-2 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">{filter === "pending" ? "队列已清空 🎉" : "无匹配记录"}</td></tr>
            )}
            {rows.map((j) => {
              const badge = STATUS_BADGE[j.reviewStatus] ?? STATUS_BADGE.pending;
              return (
                <tr key={j.id} className="border-t align-top">
                  <td className="max-w-sm px-3 py-2">
                    <a href={j.url} target="_blank" rel="noreferrer" className="text-primary hover:underline">{j.title}</a>
                    <div className="text-xs text-muted-foreground">
                      {[j.company, j.location, j.salary].filter(Boolean).join(" · ") || "—"}
                    </div>
                    {j.snippet && <div className="mt-0.5 line-clamp-2 text-xs text-muted-foreground/80">{j.snippet}</div>}
                    {j.reviewNote && <div className="mt-0.5 text-xs text-destructive">备注：{j.reviewNote}</div>}
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{j.user?.email ?? "—"}</td>
                  <td className="px-3 py-2">
                    <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
                      {j.source === "import" ? "链接导入" : "手动录入"}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <span className={`rounded px-1.5 py-0.5 text-[11px] ${badge.cls}`}>{badge.text}</span>
                  </td>
                  <td className="px-3 py-2 text-xs tabular-nums text-muted-foreground">
                    {new Date(j.createdAt).toLocaleString("zh-CN", { hour12: false })}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <JobReview id={j.id} reviewStatus={j.reviewStatus} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">第 {page} / {totalPages} 页</span>
        <div className="flex gap-2">
          {page > 1 && <Link href={`?filter=${filter}&page=${page - 1}`} className="rounded-md border px-3 py-1 hover:bg-accent">上一页</Link>}
          {page < totalPages && <Link href={`?filter=${filter}&page=${page + 1}`} className="rounded-md border px-3 py-1 hover:bg-accent">下一页</Link>}
        </div>
      </div>
    </div>
  );
}
