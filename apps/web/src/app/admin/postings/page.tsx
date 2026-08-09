import Link from "next/link";
import { listPostingReviewQueue, type ReviewFilter } from "@/lib/admin/jobs";
import { int } from "@/lib/admin/format";
import { PostingReview } from "@/components/admin/posting-review";

export const dynamic = "force-dynamic";

// 雇主发布岗审核。与 /admin/review（用户录入岗位）并列：同一治理口径，不同数据源。
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

const POSTER_ROLE_LABEL: Record<string, string> = {
  hr: "HR",
  hiring_manager: "用人经理",
  employee_referral: "内推",
};

const COMPANY_STAGE_LABEL: Record<string, string> = {
  unregistered: "尚未注册",
  startup_0_3: "0-3 年",
  growth_3_5: "3-5 年",
  stable_5_10: "5-10 年",
  mature_10plus: "10 年以上",
};

export default async function AdminPostingsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const filter = (FILTERS.some((f) => f.key === sp.filter) ? sp.filter : "pending") as ReviewFilter;
  const page = Math.max(1, Number(sp.page) || 1);
  const { rows, total, pageSize, pendingCount } = await listPostingReviewQueue({ filter, page });
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">企业发布审核</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          审核雇主发布的招聘岗位。待审核{" "}
          <span className={pendingCount > 0 ? "font-semibold text-amber-600" : ""}>{int(pendingCount)}</span> 条；
          过审后进入候选端「在招岗位」，拒绝后仅发布者本人可见拒绝理由。
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
              <th className="px-3 py-2 font-medium">发布者</th>
              <th className="px-3 py-2 font-medium">身份</th>
              <th className="px-3 py-2 font-medium">阶段</th>
              <th className="px-3 py-2 font-medium">状态</th>
              <th className="px-3 py-2 font-medium">提交时间</th>
              <th className="px-3 py-2 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">
                  {filter === "pending" ? "队列已清空 🎉" : "无匹配记录"}
                </td>
              </tr>
            )}
            {rows.map((p) => {
              const badge = STATUS_BADGE[p.reviewStatus] ?? STATUS_BADGE.pending;
              return (
                <tr key={p.id} className="border-t align-top">
                  <td className="max-w-sm px-3 py-2">
                    {p.url ? (
                      <a href={p.url} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                        {p.title}
                      </a>
                    ) : (
                      <span className="font-medium">{p.title}</span>
                    )}
                    <div className="text-xs text-muted-foreground">
                      {[p.company, p.location, p.salary].filter(Boolean).join(" · ") || "—"}
                    </div>
                    <div className="mt-0.5 line-clamp-3 text-xs text-muted-foreground/80">{p.description}</div>
                    {p.reviewNote && <div className="mt-0.5 text-xs text-destructive">备注：{p.reviewNote}</div>}
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{p.postedBy?.email ?? "—"}</td>
                  <td className="px-3 py-2">
                    <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
                      {POSTER_ROLE_LABEL[p.posterRole] ?? p.posterRole}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
                      {COMPANY_STAGE_LABEL[p.companyStage] ?? p.companyStage}
                    </span>
                  </td>
                  <td className="space-y-1 px-3 py-2">
                    <span className={`rounded px-1.5 py-0.5 text-[11px] ${badge.cls}`}>{badge.text}</span>
                    {p.status === "closed" && (
                      <div className="text-[11px] text-muted-foreground">发布者已下架</div>
                    )}
                    {p.takenDownAt && <div className="text-[11px] text-destructive">已下架</div>}
                  </td>
                  <td className="px-3 py-2 text-xs tabular-nums text-muted-foreground">
                    {new Date(p.createdAt).toLocaleString("zh-CN", { hour12: false })}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <PostingReview
                      id={p.id}
                      reviewStatus={p.reviewStatus}
                      takenDown={!!p.takenDownAt}
                    />
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
          {page > 1 && (
            <Link href={`?filter=${filter}&page=${page - 1}`} className="rounded-md border px-3 py-1 hover:bg-accent">
              上一页
            </Link>
          )}
          {page < totalPages && (
            <Link href={`?filter=${filter}&page=${page + 1}`} className="rounded-md border px-3 py-1 hover:bg-accent">
              下一页
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
