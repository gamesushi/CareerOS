import { int, usd } from "@/lib/admin/format";
import { maskEmail } from "@/lib/admin/mask";
import { prisma } from "@careeros/db";
import { TokenAdjustButton } from "./token-adjust-button";

export const dynamic = "force-dynamic";

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

// Token 管理台：全局成本看板 + 用户额度表（前 100）+ 调节入口。
export default async function AdminTokensPage() {
  const [costAgg, consumedAgg, users] = await Promise.all([
    prisma.aiRun.aggregate({
      _sum: { costUsd: true, costTokens: true },
      where: { status: "succeeded" },
    }),
    prisma.tokenTransaction.aggregate({ _sum: { delta: true }, where: { kind: "consume" } }),
    prisma.user.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        tokenBalance: { select: { balance: true, tier: true } },
        _count: { select: { aiRuns: true } },
      },
    }),
  ]);

  const totalCost = costAgg._sum.costUsd ? Number(costAgg._sum.costUsd) : 0;
  const totalTokens = costAgg._sum.costTokens ?? 0;
  const totalConsumed = Math.abs(consumedAgg._sum.delta ?? 0);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Token 管理</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          全局 AI 用量成本与用户额度调节。C 端一次性赠送 30,000、B 端 100,000；每日上限 C 8,000 / B 25,000，次日 UTC 0 点重置。
        </p>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Stat label="累计 AI 成本" value={usd(totalCost)} sub={`${int(totalTokens)} token 调用`} />
        <Stat label="累计已消耗额度" value={int(totalConsumed)} sub="consume 流水绝对值" />
        <Stat label="已发用户（前 100）" value={int(users.length)} sub="按注册时间倒序" />
      </section>

      <section>
        <h2 className="mb-2 text-sm font-medium text-muted-foreground">用户额度</h2>
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">邮箱</th>
                <th className="px-4 py-2 font-medium">角色</th>
                <th className="px-4 py-2 font-medium">档位</th>
                <th className="px-4 py-2 font-medium tabular-nums">余额</th>
                <th className="px-4 py-2 font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">
                    无用户
                  </td>
                </tr>
              )}
              {users.map((u) => (
                <tr key={u.id} className="border-t">
                  <td className="px-4 py-2 font-mono text-xs">{maskEmail(u.email)}</td>
                  <td className="px-4 py-2 font-mono text-xs">{u.role}</td>
                  <td className="px-4 py-2">{(u.tokenBalance?.tier ?? "c").toUpperCase()}</td>
                  <td className="px-4 py-2 tabular-nums">{u.tokenBalance ? int(u.tokenBalance.balance) : "—"}</td>
                  <td className="px-4 py-2">
                    <TokenAdjustButton userId={u.id} email={u.email} currentBalance={u.tokenBalance?.balance ?? null} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
