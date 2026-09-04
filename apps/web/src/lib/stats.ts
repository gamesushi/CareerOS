import { prisma } from "@careeros/db";

export type PublicStats = {
  /** 已收录在招公司数（按 DiscoveredJob.company 去重） */
  companies: number;
  /** 已收录岗位总数 */
  jobs: number;
  /** 数据生成时间（ISO 字符串） */
  generatedAt: string;
};

/**
 * 公开展示页用的聚合统计。
 *
 * 注意：这里不再返回注册用户数。注册用户是需求侧敏感指标，早期绝对值偏低，
 * 对外暴露既不必要也有害（投资人/竞品可据此推算转化与规模），故从公开展示中移除。
 * 内部分析请直接查库，不要重新加回 PublicStats。
 *
 * - 岗位数：DiscoveredJob 表总行数
 * - 公司数：DiscoveredJob.company 去重计数（company 为 null 的记 1 个"未知"桶）
 *
 * 注意：DiscoveredJob 的唯一约束是 (watchId, source, externalId)，已按"源站岗位"
 * 基本去重，但跨 watch / 跨源重复与 repost 仍可能存在，故数字为"粗聚合"口径，
 * 与排行榜（leaderboard.ts）保持一致。如需精确口径，按竞品报告 §10 #6 后续优化。
 */
export async function getPublicStats(): Promise<PublicStats> {
  // 公开口径：只计过审（用户录入需管理员通过）且未被下架的岗位
  const visible = { reviewStatus: "approved" as const, takenDownAt: null };
  const [jobs, companyGroups] = await Promise.all([
    prisma.discoveredJob.count({ where: visible }),
    prisma.discoveredJob.groupBy({
      by: ["company"],
      where: { ...visible, company: { not: null } },
    }),
  ]);

  return {
    jobs,
    companies: companyGroups.length,
    generatedAt: new Date().toISOString(),
  };
}
