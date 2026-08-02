// B 端发布岗的查询封装。
//
// 与 DiscoveredJob 的根本区别：DiscoveredJob 按 userId 行级隔离（每用户私有 feed），
// JobPosting 是全局公共池——任何候选人看到的是同一批。因此这里的「公共流」不带 userId 条件，
// 而是靠 status/reviewStatus/takenDownAt 三道闸门决定可见性。

import { prisma, type Prisma } from "@careeros/db";

/** 候选端公共流的可见性闸门：已发布 + 已过审 + 未被管理员下架。 */
export const PUBLIC_POSTING_WHERE: Prisma.JobPostingWhereInput = {
  status: "open",
  reviewStatus: "approved",
  takenDownAt: null,
};

const FEED_SELECT = {
  id: true,
  orgType: true,
  company: true,
  title: true,
  location: true,
  salary: true,
  description: true,
  url: true,
  categories: true,
  createdAt: true,
  // 有组织的岗，候选端把公司名渲染成指向 /c/<slug> 公司主页的链接
  org: { select: { slug: true, name: true, verified: true } },
} satisfies Prisma.JobPostingSelect;

/** 候选端公共流。首期全量返回（上限 200），前端做二级筛选——与 /discovered-jobs 的做法一致。 */
export async function listPublicPostings(limit = 200) {
  return prisma.jobPosting.findMany({
    where: PUBLIC_POSTING_WHERE,
    orderBy: { createdAt: "desc" },
    take: Math.min(500, Math.max(1, limit)),
    select: FEED_SELECT,
  });
}

/** 「我的发布」：发布者自己看，含草稿、待审、被拒与已下架，附审核理由。 */
export async function listMyPostings(userId: string) {
  return prisma.jobPosting.findMany({
    where: { postedByUserId: userId },
    orderBy: { createdAt: "desc" },
    take: 200,
    select: {
      ...FEED_SELECT,
      status: true,
      reviewStatus: true,
      reviewNote: true,
      takenDownAt: true,
      closedAt: true,
      updatedAt: true,
    },
  });
}
