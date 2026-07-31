import type { Queue } from "bullmq";
import { prisma, Prisma } from "@careeros/db";
import { startOfDay, startOfMonth, subDays } from "date-fns";
import { aiQueue, watchQueue } from "@/lib/queue";

const num = (v: Prisma.Decimal | number | null | undefined): number => (v == null ? 0 : Number(v));

export type QueueCounts = { name: string; waiting: number; active: number; delayed: number; failed: number; ok: boolean };

// Redis 抖动不应让整个概览 500：读不到就返回零并标记 ok=false。
async function safeQueueCounts(name: string, q: Queue): Promise<QueueCounts> {
  try {
    const c = await q.getJobCounts("waiting", "active", "delayed", "failed");
    return { name, waiting: c.waiting ?? 0, active: c.active ?? 0, delayed: c.delayed ?? 0, failed: c.failed ?? 0, ok: true };
  } catch {
    return { name, waiting: 0, active: 0, delayed: 0, failed: 0, ok: false };
  }
}

export type OverviewMetrics = {
  users: { total: number; admins: number; new7d: number; softDeleted: number };
  cost: { today: number; month: number; runsToday: number };
  reliability: { last24hTotal: number; last24hFailed: number; failureRate: number };
  queues: QueueCounts[];
};

/** 概览指标：用户 / AI 成本 / 可靠性 / 队列积压。所有查询跨用户（管理员授权）。 */
export async function getOverviewMetrics(): Promise<OverviewMetrics> {
  const now = new Date();
  const todayStart = startOfDay(now);
  const monthStart = startOfMonth(now);
  const dayAgo = subDays(now, 1);
  const weekAgo = subDays(now, 7);

  const [total, admins, new7d, softDeleted, costToday, costMonth, statusGroups, aiCounts, watchCounts] =
    await Promise.all([
      prisma.user.count({ where: { deletedAt: null } }),
      prisma.user.count({ where: { deletedAt: null, role: "admin" } }),
      prisma.user.count({ where: { deletedAt: null, createdAt: { gte: weekAgo } } }),
      prisma.user.count({ where: { deletedAt: { not: null } } }),
      prisma.aiRun.aggregate({ _sum: { costUsd: true }, _count: { _all: true }, where: { createdAt: { gte: todayStart } } }),
      prisma.aiRun.aggregate({ _sum: { costUsd: true }, where: { createdAt: { gte: monthStart } } }),
      prisma.aiRun.groupBy({ by: ["status"], _count: { _all: true }, where: { createdAt: { gte: dayAgo } } }),
      safeQueueCounts("ai", aiQueue),
      safeQueueCounts("watch", watchQueue),
    ]);

  const last24hTotal = statusGroups.reduce((s, g) => s + g._count._all, 0);
  const last24hFailed = statusGroups.find((g) => g.status === "failed")?._count._all ?? 0;

  return {
    users: { total, admins, new7d, softDeleted },
    cost: { today: num(costToday._sum.costUsd), month: num(costMonth._sum.costUsd), runsToday: costToday._count._all },
    reliability: {
      last24hTotal,
      last24hFailed,
      failureRate: last24hTotal ? last24hFailed / last24hTotal : 0,
    },
    queues: [aiCounts, watchCounts],
  };
}

export type UsageGroupRow = { key: string; runs: number; cost: number; tokensIn: number; tokensOut: number; avgLatencyMs: number };
export type UsageTrendRow = { day: string; cost: number; runs: number };
export type SlowRun = { id: string; kind: string; model: string | null; latencyMs: number; costUsd: number; createdAt: string };

export type UsageMetrics = {
  rangeDays: number;
  totals: { runs: number; cost: number; failed: number; failureRate: number };
  byKind: UsageGroupRow[];
  byModel: UsageGroupRow[];
  trend: UsageTrendRow[];
  slow: SlowRun[];
};

/** AI 用量与成本：按 kind/model 聚合 + 每日趋势 + 失败率 + 慢请求 Top10。默认统计近 rangeDays 天。 */
export async function getUsageMetrics(rangeDays = 30): Promise<UsageMetrics> {
  const since = subDays(new Date(), rangeDays);
  const where = { createdAt: { gte: since } };

  const [byKindRaw, byModelRaw, statusGroups, slowRaw, trendRaw] = await Promise.all([
    prisma.aiRun.groupBy({
      by: ["kind"],
      _count: { _all: true },
      _sum: { costUsd: true, tokensIn: true, tokensOut: true },
      _avg: { latencyMs: true },
      where,
    }),
    prisma.aiRun.groupBy({
      by: ["model"],
      _count: { _all: true },
      _sum: { costUsd: true, tokensIn: true, tokensOut: true },
      _avg: { latencyMs: true },
      where,
    }),
    prisma.aiRun.groupBy({ by: ["status"], _count: { _all: true }, where }),
    prisma.aiRun.findMany({
      where: { ...where, latencyMs: { not: null } },
      orderBy: { latencyMs: "desc" },
      take: 10,
      select: { id: true, kind: true, model: true, latencyMs: true, costUsd: true, createdAt: true },
    }),
    prisma.$queryRaw<{ day: Date; cost: Prisma.Decimal | null; runs: number }[]>(Prisma.sql`
      SELECT date_trunc('day', created_at) AS day, sum(cost_usd) AS cost, count(*)::int AS runs
      FROM careeros.ai_runs
      WHERE created_at >= ${since}
      GROUP BY day
      ORDER BY day ASC
    `),
  ]);

  const toRow = (key: string, g: { _count: { _all: number }; _sum: { costUsd: Prisma.Decimal | null; tokensIn: number | null; tokensOut: number | null }; _avg: { latencyMs: number | null } }): UsageGroupRow => ({
    key,
    runs: g._count._all,
    cost: num(g._sum.costUsd),
    tokensIn: g._sum.tokensIn ?? 0,
    tokensOut: g._sum.tokensOut ?? 0,
    avgLatencyMs: Math.round(g._avg.latencyMs ?? 0),
  });

  const totalRuns = statusGroups.reduce((s, g) => s + g._count._all, 0);
  const failed = statusGroups.find((g) => g.status === "failed")?._count._all ?? 0;

  return {
    rangeDays,
    totals: {
      runs: totalRuns,
      cost: byKindRaw.reduce((s, g) => s + num(g._sum.costUsd), 0),
      failed,
      failureRate: totalRuns ? failed / totalRuns : 0,
    },
    byKind: byKindRaw.map((g) => toRow(g.kind, g)).sort((a, b) => b.cost - a.cost),
    byModel: byModelRaw.map((g) => toRow(g.model ?? "(未知)", g)).sort((a, b) => b.cost - a.cost),
    trend: trendRaw.map((r) => ({ day: r.day.toISOString().slice(0, 10), cost: num(r.cost), runs: r.runs })),
    slow: slowRaw.map((r) => ({
      id: r.id,
      kind: r.kind,
      model: r.model,
      latencyMs: r.latencyMs ?? 0,
      costUsd: num(r.costUsd),
      createdAt: r.createdAt.toISOString(),
    })),
  };
}
