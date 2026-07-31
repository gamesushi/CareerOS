import { prisma } from "@careeros/db";

export type LeaderboardBy = "company" | "source";
export type LeaderboardItem = { name: string; count: number };
export type LeaderboardResult = {
  by: LeaderboardBy;
  remoteOnly: boolean;
  generatedAt: string;
  total: number;
  items: LeaderboardItem[];
  dedupNote: string;
};

// 远程判定：基于 location 字段的启发式子串匹配（非雇主官方标注）。
const REMOTE_TOKENS = ["remote", "远程", "居家", "在家", "wfh", "telecommute", "work from home"];
const MAX_LIMIT = 200;

export function parseLeaderboardBy(raw: string | null | undefined): LeaderboardBy {
  return raw === "source" ? "source" : "company";
}

export function parseLeaderboardLimit(raw: string | null | undefined): number {
  const n = Number.parseInt(raw ?? "", 10);
  if (!Number.isFinite(n) || n <= 0) return 50;
  return Math.min(n, MAX_LIMIT);
}

export function parseRemoteFlag(raw: string | null | undefined): boolean {
  return raw === "1" || raw === "true";
}

function remoteWhere() {
  return {
    OR: REMOTE_TOKENS.map((t) => ({ location: { contains: t, mode: "insensitive" as const } })),
  };
}

/**
 * 聚合 DiscoveredJob 的公司 / 来源在招职位数排行榜。
 * 注意：这是"粗聚合"——按源站岗位记录计数（表唯一约束 watchId+source+externalId），
 * 可能含跨 watch / 跨源重复及 repost。repost / 跨源去重口径按竞品报告 §10 #6 待后续优化。
 */
export async function getLeaderboard(opts: {
  by?: LeaderboardBy;
  remote?: boolean;
  limit?: number;
}): Promise<LeaderboardResult> {
  const by = opts.by ?? "company";
  const remote = opts.remote ?? false;
  const limit = opts.limit ?? 50;

  const where: Record<string, unknown> = {
    reviewStatus: "approved", // 用户录入岗位过审后才计入公开排行榜
    takenDownAt: null, // 管理员下架的岗位不计入
  };
  if (remote) Object.assign(where, remoteWhere());
  if (by === "company") where.company = { not: null };

  const [groups, total] = await Promise.all([
    prisma.discoveredJob.groupBy({
      by: by === "company" ? (["company"] as const) : (["source"] as const),
      where,
      _count: { _all: true },
      orderBy: { _count: by === "company" ? { company: "desc" } : { source: "desc" } },
      take: limit,
    }),
    prisma.discoveredJob.count({ where }),
  ]);

  const items: LeaderboardItem[] = groups.map((g) => {
    const name = by === "company" ? (g as { company: string | null }).company : (g as { source: string }).source;
    const count = (g as { _count: { _all: number } })._count._all;
    return { name: name ?? "(未知)", count };
  });

  return {
    by,
    remoteOnly: remote,
    generatedAt: new Date().toISOString(),
    total,
    items,
    dedupNote:
      "粗聚合：按源站岗位记录计数（表唯一约束为 watchId+source+externalId），可能含跨 watch / 跨源重复及 repost。" +
      "repost / 跨源去重口径按竞品报告 §10 #6 待后续优化。远程判定为 location 字段的启发式匹配，非雇主官方标注。",
  };
}
