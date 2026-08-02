// 站内投递：候选人 → 站内发布岗。
//
// 隐私边界（docs/b-end-phase3-apply.md §4）：投递意味着候选人主动把「这一份」简历
// 交给「这个」雇主。因此雇主的可见范围严格限定为——他自己岗位下的投递、以及投递里
// 那一份简历。判定只写在 canEmployerSeeApplication 一处，简历访问路由必须走它，
// 不能只靠「知道 resumeId」放行，否则 id 就变成了访问令牌。

import { prisma, type JobApplicationStatus, type Prisma } from "@careeros/db";
import { ApiError } from "@/lib/errors";

/** 终态：不再流转。 */
export const TERMINAL_STATUSES: readonly JobApplicationStatus[] = ["offer", "rejected", "withdrawn"];

/** 雇主可置的状态。刻意不含 withdrawn——撤回是候选人的动作，雇主不能替他撤。 */
export const EMPLOYER_STATUSES: readonly JobApplicationStatus[] = [
  "screening",
  "interview",
  "offer",
  "rejected",
];

/**
 * 雇主能否看到这条投递：是岗位发布者本人，或岗位所属组织的成员。
 * 返回投递本身（含岗位与候选人摘要）；无权或不存在一律 404/403。
 */
export async function requireEmployerOnApplication(applicationId: string, userId: string) {
  const app = await prisma.jobApplication.findUnique({
    where: { id: applicationId },
    select: {
      id: true,
      status: true,
      resumeId: true,
      candidateId: true,
      jobPosting: { select: { id: true, title: true, postedByUserId: true, orgId: true } },
    },
  });
  if (!app) throw new ApiError(404, "not_found", "投递不存在");

  if (app.jobPosting.postedByUserId === userId) return app;

  if (app.jobPosting.orgId) {
    const member = await prisma.organizationMember.findUnique({
      where: { orgId_userId: { orgId: app.jobPosting.orgId, userId } },
      select: { id: true },
    });
    if (member) return app;
  }
  throw new ApiError(403, "forbidden", "你无权查看该投递");
}

/** 同上，但用于「按岗位」的列表接口。 */
export async function requireEmployerOnPosting(jobPostingId: string, userId: string) {
  const posting = await prisma.jobPosting.findUnique({
    where: { id: jobPostingId },
    select: { id: true, title: true, company: true, postedByUserId: true, orgId: true },
  });
  if (!posting) throw new ApiError(404, "not_found", "岗位不存在");
  if (posting.postedByUserId === userId) return posting;
  if (posting.orgId) {
    const member = await prisma.organizationMember.findUnique({
      where: { orgId_userId: { orgId: posting.orgId, userId } },
      select: { id: true },
    });
    if (member) return posting;
  }
  throw new ApiError(403, "forbidden", "你无权查看该岗位的投递");
}

/** 雇主收件箱。employerNote 只在这条路径上返回——候选人侧接口一律不带。 */
export async function listApplicationsForPosting(jobPostingId: string) {
  return prisma.jobApplication.findMany({
    where: { jobPostingId },
    orderBy: { createdAt: "desc" },
    take: 200,
    select: {
      id: true,
      status: true,
      coverLetter: true,
      employerNote: true,
      statusAt: true,
      createdAt: true,
      candidate: { select: { name: true, email: true, image: true } },
      resume: { select: { id: true, title: true, resumeType: true } },
    },
  });
}

/** 候选人「我投过的」。刻意不选 employerNote（雇主备注对候选人不可见）。 */
export async function listMyApplications(candidateId: string) {
  return prisma.jobApplication.findMany({
    where: { candidateId },
    orderBy: { createdAt: "desc" },
    take: 200,
    select: {
      id: true,
      jobPostingId: true,
      status: true,
      createdAt: true,
      jobPosting: { select: { title: true, company: true } },
    },
  });
}

/** 可投递的岗位：已过审在招未下架，且不是自己发的。 */
export async function assertApplicable(jobPostingId: string, candidateId: string) {
  const posting = await prisma.jobPosting.findUnique({
    where: { id: jobPostingId },
    select: {
      id: true,
      status: true,
      reviewStatus: true,
      takenDownAt: true,
      postedByUserId: true,
    },
  });
  if (!posting) throw new ApiError(404, "not_found", "岗位不存在");
  if (posting.status !== "open" || posting.reviewStatus !== "approved" || posting.takenDownAt) {
    throw new ApiError(409, "not_open", "该岗位当前不接受投递");
  }
  if (posting.postedByUserId === candidateId) {
    throw new ApiError(400, "self_apply", "不能投递自己发布的岗位");
  }
  return posting;
}

/** 状态流转校验：终态不可再动；雇主与候选人各自只能置自己那组状态。 */
export function assertTransition(
  current: JobApplicationStatus,
  next: JobApplicationStatus,
  by: "employer" | "candidate",
) {
  if (TERMINAL_STATUSES.includes(current)) {
    throw new ApiError(409, "terminal", "该投递已结束，不能再变更状态");
  }
  if (by === "employer" && !EMPLOYER_STATUSES.includes(next)) {
    throw new ApiError(400, "invalid_status", "雇主不能将投递置为该状态");
  }
  if (by === "candidate" && next !== "withdrawn") {
    throw new ApiError(403, "forbidden", "候选人只能撤回投递");
  }
}

export const applicationCreateData = (
  jobPostingId: string,
  candidateId: string,
  resumeId: string | null,
  coverLetter: string | null,
): Prisma.JobApplicationUncheckedCreateInput => ({
  jobPostingId,
  candidateId,
  resumeId,
  coverLetter,
  status: "submitted",
  statusAt: new Date(),
});
