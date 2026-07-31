import Link from "next/link";
import { listUsers, type UserStatus } from "@/lib/admin/users";
import { maskEmail } from "@/lib/admin/mask";
import { int } from "@/lib/admin/format";
import type { UserRole } from "@careeros/db";

export const dynamic = "force-dynamic";

const ROLES: UserRole[] = ["guest", "user", "recruiter", "admin", "enterprise"];
const STATUSES: UserStatus[] = ["active", "deleted", "banned"];

function StatusBadge({ deleted, banned }: { deleted: boolean; banned: boolean }) {
  if (banned) return <span className="rounded bg-destructive/10 px-1.5 py-0.5 text-[11px] text-destructive">已封禁</span>;
  if (deleted) return <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">已软删</span>;
  return <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-[11px] text-emerald-600">正常</span>;
}

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; role?: string; status?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const role = ROLES.includes(sp.role as UserRole) ? (sp.role as UserRole) : undefined;
  const status = STATUSES.includes(sp.status as UserStatus) ? (sp.status as UserStatus) : undefined;
  const page = Math.max(1, Number(sp.page) || 1);
  const { rows, total, pageSize } = await listUsers({ q: sp.q, role, status, page });
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const qs = (patch: Record<string, string | number | undefined>) => {
    const p = new URLSearchParams();
    if (sp.q) p.set("q", sp.q);
    if (role) p.set("role", role);
    if (status) p.set("status", status);
    p.set("page", String(page));
    for (const [k, v] of Object.entries(patch)) {
      if (v == null) p.delete(k);
      else p.set(k, String(v));
    }
    return `?${p.toString()}`;
  };

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">用户</h1>
        <p className="mt-1 text-sm text-muted-foreground">共 {int(total)} 人。邮箱脱敏展示，点行查看详情与管理操作。</p>
      </header>

      <form className="flex flex-wrap items-center gap-2" method="get">
        <input
          name="q"
          defaultValue={sp.q ?? ""}
          placeholder="搜索邮箱 / 姓名"
          className="w-56 rounded-md border bg-background px-2 py-1.5 text-sm"
        />
        <select name="role" defaultValue={role ?? ""} className="rounded-md border bg-background px-2 py-1.5 text-sm">
          <option value="">全部角色</option>
          {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        <select name="status" defaultValue={status ?? ""} className="rounded-md border bg-background px-2 py-1.5 text-sm">
          <option value="">全部状态</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <button type="submit" className="rounded-md border bg-background px-3 py-1.5 text-sm hover:bg-accent">筛选</button>
      </form>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-2 font-medium">邮箱</th>
              <th className="px-4 py-2 font-medium">姓名</th>
              <th className="px-4 py-2 font-medium">角色</th>
              <th className="px-4 py-2 font-medium">状态</th>
              <th className="px-4 py-2 font-medium">注册时间</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">无匹配用户</td></tr>
            )}
            {rows.map((u) => (
              <tr key={u.id} className="border-t hover:bg-accent/40">
                <td className="px-4 py-2">
                  <Link href={`/admin/users/${u.id}`} className="font-mono text-xs text-primary hover:underline">
                    {maskEmail(u.email)}
                  </Link>
                </td>
                <td className="px-4 py-2">{u.name}</td>
                <td className="px-4 py-2 font-mono text-xs">{u.role}</td>
                <td className="px-4 py-2"><StatusBadge deleted={!!u.deletedAt} banned={!!u.bannedAt} /></td>
                <td className="px-4 py-2 text-xs text-muted-foreground">{u.createdAt.slice(0, 10)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">第 {page} / {totalPages} 页</span>
        <div className="flex gap-2">
          {page > 1 && <Link href={qs({ page: page - 1 })} className="rounded-md border px-3 py-1 hover:bg-accent">上一页</Link>}
          {page < totalPages && <Link href={qs({ page: page + 1 })} className="rounded-md border px-3 py-1 hover:bg-accent">下一页</Link>}
        </div>
      </div>
    </div>
  );
}
