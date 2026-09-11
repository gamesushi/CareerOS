// Token 额度核心库（Web 侧）。逻辑与 apps/worker/src/billing/tokens.ts 保持一致。
// 内部 token 与 AI token 1:1：一次 AI 操作扣 tokensIn + tokensOut。
// 余额行首次访问惰性创建，按角色赠送免费额度（C 求职者 / B 招聘方）。
//
// 详见 docs/token-system-plan.md。

import { prisma, Prisma, type AiRunKind } from "@careeros/db";
import { ApiError } from "@/lib/errors";

// 分档：免费额度（一次性，不刷新）+ 每日硬性上限（防刷/防跑飞）
export const TIERS = {
  c: { free: 30000, dailyCap: 8000, label: "C 端求职者" },
  b: { free: 100000, dailyCap: 25000, label: "B 端招聘方" },
} as const;

export type Tier = keyof typeof TIERS;

// 余额预留（中值估计，用于预检「余额是否够本次」）：
// 真实扣费在 finish 时按 tokensIn+tokensOut 执行；若真实用量超出预留，扣费兜底
// （余额不足时 deduct 失败、调用照常完成，平台微亏），避免单次大任务误杀正常用户。
export const BALANCE_EST: Record<AiRunKind, number> = {
  resume_parse: 6000,
  jd_parse: 5000,
  resume_generate: 9000,
  profile_generate: 4000,
  worklog_summarize: 1500,
  job_match: 2000,
  skill_extract: 2000,
  translate: 3000,
  writing: 5000,
  negotiation: 4000,
};

// 价格缺失时的兜底单价（¥ / 1K token）
const FALLBACK_PRICE = { inPer1k: 0.002, outPer1k: 0.01 };

function startOfUtcDay(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

/** 解析账号档位：招聘方/企业/管理员，或属于某组织 → B 端，否则 C 端。 */
export async function resolveTier(userId: string): Promise<Tier> {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, _count: { select: { orgMemberships: true } } },
  });
  if (!u) return "c";
  const isB =
    u.role === "recruiter" || u.role === "enterprise" || u.role === "admin" || (u._count?.orgMemberships ?? 0) > 0;
  return isB ? "b" : "c";
}

/** 读取余额（无则按角色惰性创建并发放免费额度）。 */
export async function getBalance(userId: string): Promise<number> {
  const tier = await resolveTier(userId);
  const free = TIERS[tier].free;
  const row = await prisma.tokenBalance.upsert({
    where: { userId },
    update: {},
    create: { userId, balance: free, freeQuota: free, tier },
    select: { balance: true },
  });
  return row.balance;
}

/** 当日（UTC）已消耗 token 总量（consume 流水绝对值之和）。 */
export async function getDailyUsed(userId: string): Promise<number> {
  const agg = await prisma.tokenTransaction.aggregate({
    _sum: { delta: true },
    where: { userId, kind: "consume", createdAt: { gte: startOfUtcDay() } },
  });
  return Math.abs(agg._sum.delta ?? 0);
}

/** 预检：余额是否够本次估计、当日是否已达上限。 */
export async function checkQuota(
  userId: string,
  kind: AiRunKind,
): Promise<{ ok: true } | { ok: false; code: "token_balance" | "token_daily"; message: string }> {
  const est = BALANCE_EST[kind] ?? 6000;
  const balance = await getBalance(userId);
  if (balance < est) {
    return {
      ok: false,
      code: "token_balance",
      message: `token 余额不足（本次约需 ${est}，当前 ${balance}），请联系管理员发放额度或充值`,
    };
  }
  const tier = await resolveTier(userId);
  const cap = TIERS[tier].dailyCap;
  const used = await getDailyUsed(userId);
  // 每日上限基于真实累计用量（不加上界，避免单次大任务被误杀）；达到即关闸，次日 UTC 0 点重置。
  if (used >= cap) {
    return { ok: false, code: "token_daily", message: `今日用量已达上限（${used}/${cap}），请明日再试` };
  }
  return { ok: true };
}

/** 在 AI 路由/任务入口调用：不满足额度直接抛 402。 */
export async function assertAiQuota(userId: string, kind: AiRunKind): Promise<void> {
  const r = await checkQuota(userId, kind);
  if (!r.ok) throw new ApiError(402, r.code, r.message);
}

/** 原子扣费（消费）。余额不足返回 { ok:false } 不抛错。 */
export async function deductTokens(
  userId: string,
  amount: number,
  refType: string,
  refId: string | null,
  note?: string,
): Promise<{ ok: boolean; balance: number }> {
  if (!amount || amount <= 0) return { ok: true, balance: await getBalance(userId) };
  return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const tier = await resolveTier(userId);
    const free = TIERS[tier].free;
    const row = await tx.tokenBalance.upsert({
      where: { userId },
      update: {},
      create: { userId, balance: free, freeQuota: free, tier },
      select: { balance: true },
    });
    if (row.balance < amount) return { ok: false, balance: row.balance };
    const updated = await tx.tokenBalance.update({
      where: { userId },
      data: { balance: { decrement: amount } },
      select: { balance: true },
    });
    await tx.tokenTransaction.create({
      data: { userId, delta: -amount, kind: "consume", refType, refId, balanceAfter: updated.balance, note },
    });
    return { ok: true, balance: updated.balance };
  });
}

/** 管理员发放/扣减（模拟充值/校正）。返回变动后余额。 */
export async function grantTokens(
  userId: string,
  amount: number,
  kind: "grant" | "deduct",
  note?: string,
): Promise<number> {
  const delta = kind === "grant" ? Math.abs(amount) : -Math.abs(amount);
  return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const tier = await resolveTier(userId);
    const free = TIERS[tier].free;
    await tx.tokenBalance.upsert({
      where: { userId },
      update: {},
      create: { userId, balance: free, freeQuota: free, tier },
    });
    const updated = await tx.tokenBalance.update({
      where: { userId },
      data: { balance: { increment: delta } },
      select: { balance: true },
    });
    await tx.tokenTransaction.create({
      data: { userId, delta, kind, refType: "admin", refId: null, balanceAfter: updated.balance, note },
    });
    return updated.balance;
  });
}

const toNum = (v: unknown): number =>
  v && typeof (v as { toNumber?: unknown }).toNumber === "function"
    ? (v as { toNumber: () => number }).toNumber()
    : Number(v);

/** 按模型单价计算本次真实 ¥ 成本（写 AiRun.costUsd 用）。inPer1k/outPer1k 为 Decimal，需转 number。 */
export async function costForModel(model: string | null | undefined, tokensIn: number, tokensOut: number): Promise<number> {
  if (!model || model === "mock" || (tokensIn <= 0 && tokensOut <= 0)) return 0;
  const p = await prisma.tokenPrice.findUnique({ where: { model } });
  const inRate = p ? toNum(p.inPer1k) : FALLBACK_PRICE.inPer1k;
  const outRate = p ? toNum(p.outPer1k) : FALLBACK_PRICE.outPer1k;
  return (tokensIn * inRate + tokensOut * outRate) / 1000;
}

/** 设置页/API 用：账号当前额度快照。 */
export async function getTokenStatus(userId: string): Promise<{
  balance: number;
  tier: Tier;
  freeQuota: number;
  dailyCap: number;
  dailyUsed: number;
}> {
  const tier = await resolveTier(userId);
  const cfg = TIERS[tier];
  const row = await prisma.tokenBalance.upsert({
    where: { userId },
    update: {},
    create: { userId, balance: cfg.free, freeQuota: cfg.free, tier },
    select: { balance: true, freeQuota: true },
  });
  const dailyUsed = await getDailyUsed(userId);
  return { balance: row.balance, tier, freeQuota: row.freeQuota, dailyCap: cfg.dailyCap, dailyUsed };
}
