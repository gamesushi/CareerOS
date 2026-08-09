import { prisma, Prisma } from "@careeros/db";

export type JobState = "all" | "active" | "takendown";
export type ListJobsParams = { source?: string; q?: string; state?: JobState; page?: number; pageSize?: number };

export async function listDiscoveredJobs(p: ListJobsParams) {
  const page = Math.max(1, p.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, p.pageSize ?? 20));
  const where: Prisma.DiscoveredJobWhereInput = {};
  if (p.source) where.source = p.source;
  if (p.q) where.OR = [{ title: { contains: p.q, mode: "insensitive" } }, { company: { contains: p.q, mode: "insensitive" } }];
  if (p.state === "active") where.takenDownAt = null;
  else if (p.state === "takendown") where.takenDownAt = { not: null };

  const [rows, total] = await Promise.all([
    prisma.discoveredJob.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true, source: true, externalId: true, title: true, company: true,
        location: true, url: true, status: true, takenDownAt: true, createdAt: true,
      },
    }),
    prisma.discoveredJob.count({ where }),
  ]);
  return { rows, total, page, pageSize };
}

/** 全局下架/恢复：按 (source, externalId) 命中所有用户下的同一外部岗位。返回受影响行数。 */
export async function takedownByExternal(source: string, externalId: string, restore: boolean, actorId: string): Promise<number> {
  const res = await prisma.discoveredJob.updateMany({
    where: { source, externalId },
    data: { takenDownAt: restore ? null : new Date(), takenDownById: restore ? null : actorId },
  });
  return res.count;
}

// ============ 用户录入岗位审核队列 ============

export type ReviewFilter = "pending" | "approved" | "rejected" | "all";

/** 审核队列：只看用户录入来源（user/import）的岗位。 */
export async function listReviewQueue(p: { filter?: ReviewFilter; page?: number; pageSize?: number }) {
  const page = Math.max(1, p.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, p.pageSize ?? 20));
  const filter = p.filter ?? "pending";
  const where: Prisma.DiscoveredJobWhereInput = { source: { in: ["user", "import"] } };
  if (filter !== "all") where.reviewStatus = filter;

  const [rows, total, pendingCount] = await Promise.all([
    prisma.discoveredJob.findMany({
      where,
      orderBy: { createdAt: "asc" }, // 先提交的先审
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true, source: true, title: true, company: true, location: true,
        salary: true, url: true, snippet: true, reviewStatus: true, reviewNote: true,
        reviewedAt: true, createdAt: true,
        user: { select: { email: true, name: true } },
      },
    }),
    prisma.discoveredJob.count({ where }),
    prisma.discoveredJob.count({ where: { source: { in: ["user", "import"] }, reviewStatus: "pending" } }),
  ]);
  return { rows, total, page, pageSize, pendingCount };
}

/** 审核用户录入岗位：approve / reject。返回审核前快照（供审计），未命中返回 null。 */
export async function reviewUserJob(
  id: string,
  decision: "approved" | "rejected",
  actorId: string,
  note?: string,
) {
  const before = await prisma.discoveredJob.findUnique({
    where: { id },
    select: { id: true, title: true, company: true, url: true, source: true, reviewStatus: true, userId: true },
  });
  if (!before) return null;
  // 只允许审用户录入来源，防止误操作抓取数据
  if (before.source !== "user" && before.source !== "import") return null;
  await prisma.discoveredJob.update({
    where: { id },
    data: {
      reviewStatus: decision,
      reviewedAt: new Date(),
      reviewedById: actorId,
      reviewNote: note?.slice(0, 500) ?? null,
    },
  });
  return before;
}

// ============ B 端雇主发布岗审核队列 ============
// 与用户录入岗位（DiscoveredJob）同一治理口径，只是落在 job_postings 表。
// 未过审的发布不进候选端公共流（见 lib/job-postings.ts 的 PUBLIC_POSTING_WHERE）。

/** 发布审核队列：只看已提交发布（status != draft）的岗，草稿不占审核工时。 */
export async function listPostingReviewQueue(p: { filter?: ReviewFilter; page?: number; pageSize?: number }) {
  const page = Math.max(1, p.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, p.pageSize ?? 20));
  const filter = p.filter ?? "pending";
  const where: Prisma.JobPostingWhereInput = { status: { not: "draft" } };
  if (filter !== "all") where.reviewStatus = filter;

  const [rows, total, pendingCount] = await Promise.all([
    prisma.jobPosting.findMany({
      where,
      orderBy: { createdAt: "asc" }, // 先提交的先审
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true, posterRole: true, companyStage: true, company: true, title: true, location: true,
        salary: true, url: true, referralCode: true, description: true, status: true,
        reviewStatus: true, reviewNote: true, reviewedAt: true,
        takenDownAt: true, createdAt: true,
        postedBy: { select: { email: true, name: true } },
      },
    }),
    prisma.jobPosting.count({ where }),
    prisma.jobPosting.count({ where: { status: { not: "draft" }, reviewStatus: "pending" } }),
  ]);
  return { rows, total, page, pageSize, pendingCount };
}

/** 审核雇主发布岗：approve / reject。返回审核前快照（供审计），未命中返回 null。 */
export async function reviewJobPosting(
  id: string,
  decision: "approved" | "rejected",
  actorId: string,
  note?: string,
) {
  const before = await prisma.jobPosting.findUnique({
    where: { id },
    select: { id: true, title: true, company: true, status: true, reviewStatus: true, postedByUserId: true },
  });
  if (!before) return null;
  if (before.status === "draft") return null; // 草稿不该出现在队列里，兜底拒绝误操作
  await prisma.jobPosting.update({
    where: { id },
    data: {
      reviewStatus: decision,
      reviewedAt: new Date(),
      reviewedById: actorId,
      reviewNote: note?.slice(0, 500) ?? null,
    },
  });
  return before;
}

/** 发布岗下架/恢复（诈骗、幽灵岗）。与 DiscoveredJob 的 takedown 同义，但只影响单条。 */
export async function takedownPosting(id: string, restore: boolean, actorId: string) {
  const before = await prisma.jobPosting.findUnique({
    where: { id },
    select: { id: true, title: true, company: true, takenDownAt: true },
  });
  if (!before) return null;
  await prisma.jobPosting.update({
    where: { id },
    data: {
      takenDownAt: restore ? null : new Date(),
      takenDownById: restore ? null : actorId,
    },
  });
  return before;
}

/** 抓取源健康：按 source 聚合岗位数 + 已下架数。 */
export async function listSourceHealth() {
  const [totals, takendown] = await Promise.all([
    prisma.discoveredJob.groupBy({ by: ["source"], _count: { _all: true } }),
    prisma.discoveredJob.groupBy({ by: ["source"], _count: { _all: true }, where: { takenDownAt: { not: null } } }),
  ]);
  const tdMap = new Map(takendown.map((t) => [t.source, t._count._all]));
  return totals
    .map((t) => ({ source: t.source, total: t._count._all, takenDown: tdMap.get(t.source) ?? 0 }))
    .sort((a, b) => b.total - a.total);
}
