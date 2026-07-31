import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getUserDetail } from "@/lib/admin/users";
import { maskEmail, maskSecret } from "@/lib/admin/mask";
import { int } from "@/lib/admin/format";
import { UserActions } from "@/components/admin/user-actions";

export const dynamic = "force-dynamic";

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-1.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}

export default async function AdminUserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const u = await getUserDetail(id);
  if (!u) notFound();

  const counts = u._count;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link href="/admin/users" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> 返回用户列表
      </Link>

      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{u.name}</h1>
        <p className="mt-1 font-mono text-sm text-muted-foreground">{maskEmail(u.email)}</p>
      </header>

      <section className="rounded-lg border bg-card p-4">
        <h2 className="mb-2 text-sm font-medium text-muted-foreground">基础信息（PII 脱敏）</h2>
        <Field label="角色" value={<span className="font-mono">{u.role}</span>} />
        <Field label="状态" value={u.bannedAt ? "已封禁" : u.deletedAt ? "已软删" : "正常"} />
        <Field label="求职状态" value={u.jobStatus} />
        <Field label="语言/地区" value={`${u.locale} / ${u.region ?? "—"}`} />
        <Field label="WeKnora Key" value={maskSecret(u.weknoraApiKey)} />
        <Field label="注册时间" value={u.createdAt.toISOString().slice(0, 16).replace("T", " ")} />
      </section>

      <section className="rounded-lg border bg-card p-4">
        <h2 className="mb-2 text-sm font-medium text-muted-foreground">关联数据</h2>
        <div className="grid grid-cols-3 gap-3 text-center sm:grid-cols-6">
          {[
            ["简历", counts.resumes],
            ["JD", counts.jds],
            ["匹配", counts.jobMatches],
            ["发现岗位", counts.discoveredJobs],
            ["工作日志", counts.workLogs],
            ["AI 调用", counts.aiRuns],
          ].map(([label, n]) => (
            <div key={label as string}>
              <p className="text-lg font-semibold tabular-nums">{int(n as number)}</p>
              <p className="text-xs text-muted-foreground">{label}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-lg border bg-card p-4">
        <h2 className="mb-3 text-sm font-medium text-muted-foreground">管理操作（写操作均记入审计）</h2>
        <UserActions userId={u.id} role={u.role} isDeleted={!!u.deletedAt} isBanned={!!u.bannedAt} />
      </section>
    </div>
  );
}
