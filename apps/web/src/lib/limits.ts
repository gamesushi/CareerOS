// 用量配额。
//
// 与 lib/rate-limit.ts 的区别：那个是进程内滑动窗口，给无用户上下文的公开端点做基础防刷，
// 多实例部署下不精确；这里按 userId 查库计数，跨实例、跨重启都准确，代价是每次多一次 count。
// 发岗这种低频写操作用后者合适。

import { prisma } from "@careeros/db";
import { ApiError } from "@/lib/errors";
import { getOrgEntitlement } from "@/lib/billing/entitlement";

/** 每人每 24 小时最多新建的岗位数（含草稿——草稿同样占存储与审核视野）。 */
export const POSTING_DAILY_LIMIT = 10;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * 发岗配额。超限抛 429，让前端能区分「参数错」与「发太多了」。
 *
 * 口径：过去 24 小时内**现存**的岗位数（含草稿与已下架，不看当前状态）。
 * 已知空子：删掉旧记录能把额度腾出来——要堵死得单独记用量流水，
 * 对「防手滑刷屏」这个目标来说不值当，真遇到刷子该上的是审核与封禁。
 */
export async function assertPostingQuota(userId: string, limit = POSTING_DAILY_LIMIT) {
  const since = new Date(Date.now() - DAY_MS);
  const used = await prisma.jobPosting.count({
    where: { postedByUserId: userId, createdAt: { gt: since } },
  });
  if (used >= limit) {
    throw new ApiError(
      429,
      "posting_quota",
      `24 小时内最多发布 ${limit} 个岗位，你已发布 ${used} 个，请稍后再试`,
    );
  }
  return { used, limit };
}

/**
 * 组织档位在招岗上限校验：统计该组织当前 `open` 岗位数，与套餐上限比较。
 * 免费档最多 FREE_ACTIVE_POSTING_LIMIT 个；Pro 档按套餐 maxActivePostings。
 * 超额抛 403，文案区分免费 / 会员，引导升级。
 */
export async function assertOrgActivePostingQuota(orgId: string) {
  const { maxActivePostings, isSubscribed, plan } = await getOrgEntitlement(orgId);
  const used = await prisma.jobPosting.count({ where: { orgId, status: "open" } });
  if (used >= maxActivePostings) {
    throw new ApiError(
      403,
      "org_posting_quota",
      isSubscribed
        ? `当前「${plan?.name ?? "会员"}」套餐最多 ${maxActivePostings} 个在招岗位，已用满，请升级套餐`
        : `免费版最多 ${maxActivePostings} 个在招岗位，升级 Pro 解锁更多在招岗`,
    );
  }
  return { used, limit: maxActivePostings };
}
