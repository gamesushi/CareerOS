// 当前账号的 token 额度快照：余额、档位、每日上限/已用、价格表、近期流水。
// 供设置页「Token 卡片」与 AI 触发处的额度提示使用。

import { handler, ok, requireUser } from "@/lib/api";
import { getTokenStatus, TIERS } from "@/lib/tokens";
import { prisma } from "@careeros/db";

export const GET = handler(async () => {
  const { userId } = await requireUser();
  const status = await getTokenStatus(userId);

  const prices = await prisma.tokenPrice.findMany({ orderBy: { model: "asc" } });
  const transactions = await prisma.tokenTransaction.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 30,
    select: {
      id: true,
      delta: true,
      kind: true,
      refType: true,
      balanceAfter: true,
      note: true,
      createdAt: true,
    },
  });

  return ok({
    balance: status.balance,
    tier: status.tier,
    tierLabel: TIERS[status.tier].label,
    freeQuota: status.freeQuota,
    dailyCap: status.dailyCap,
    dailyUsed: status.dailyUsed,
    dailyRemaining: Math.max(status.dailyCap - status.dailyUsed, 0),
    prices: prices.map((p) => ({
      model: p.model,
      label: p.label,
      inPer1k: Number(p.inPer1k),
      outPer1k: Number(p.outPer1k),
      currency: p.currency,
    })),
    transactions: transactions.map((t) => ({
      id: t.id,
      delta: t.delta,
      kind: t.kind,
      refType: t.refType,
      balanceAfter: t.balanceAfter,
      note: t.note,
      createdAt: t.createdAt,
    })),
  });
});
