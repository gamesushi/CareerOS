import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@careeros/db";
import { AccountDanger } from "./account-danger";
import { AccountExport } from "./account-export";
import { EmployerRole } from "./employer-role";

export const metadata = { title: "账号设置 · CareerOS" };

// 账号设置：展示近期登录（登录审计透明化），并提供自助注销入口。
export default async function SettingsPage() {
  const session = await getSession();
  if (!session?.user?.id) redirect("/login");
  const userId = session.user.id;

  const [recent, me] = await Promise.all([
    prisma.loginLog.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    // 角色查 DB：session 里的 role 是登录快照，切换后不重登会显示过期状态
    prisma.user.findUnique({ where: { id: userId }, select: { role: true } }),
  ]);

  return (
    <div className="mx-auto max-w-2xl space-y-8 px-4 py-10">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">账号设置</h1>
        <p className="mt-1 text-sm text-muted-foreground">{session.user.email}</p>
      </header>

      <section>
        <h2 className="mb-3 text-sm font-medium text-muted-foreground">近期登录</h2>
        {recent.length === 0 ? (
          <p className="text-sm text-muted-foreground">暂无登录记录</p>
        ) : (
          <ul className="divide-y rounded-md border">
            {recent.map((l) => (
              <li
                key={l.id}
                className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm"
              >
                <span className="tabular-nums text-muted-foreground">
                  {new Date(l.createdAt).toLocaleString("zh-CN")}
                </span>
                <span className="capitalize">{l.method}</span>
                <span className={l.success ? "text-green-600" : "text-red-600"}>
                  {l.success ? "成功" : "失败"}
                </span>
                <span className="max-w-[10rem] truncate text-xs text-muted-foreground">
                  {l.ip ?? "-"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <EmployerRole role={me?.role ?? "user"} />

      <AccountExport />

      <AccountDanger />
    </div>
  );
}
