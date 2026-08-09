// 雇主发岗：GET 我的发布 / POST 新建。
// 门禁走 requireRole（查 DB），而非 session.user.role —— 用户刚在设置页切成招聘者、
// 尚未重新登录时，JWT 里的 role 还是旧值。

import { prisma, type Prisma, type OrgType } from "@careeros/db";
import { jobPostingCreateInput, EMPLOYER_ROLES } from "@careeros/shared";
import { handler, ok, parseBody, requireRole, ApiError } from "@/lib/api";
import { listMyPostings } from "@/lib/job-postings";
import { requireOrgMember } from "@/lib/organizations";
import { assertPostingQuota } from "@/lib/limits";

const NEED_EMPLOYER = "需要招聘者权限，请在「账号设置」中开启发岗";

export const GET = handler(async () => {
  const { userId } = await requireRole(EMPLOYER_ROLES, NEED_EMPLOYER);
  return ok({ data: await listMyPostings(userId) });
});

export const POST = handler(async (req) => {
  const { userId } = await requireRole(EMPLOYER_ROLES, NEED_EMPLOYER);
  const input = await parseBody(req, jobPostingCreateInput);
  await assertPostingQuota(userId); // 反垃圾：每人每 24 小时的发布上限

  // 以组织名义发布：校验成员身份，并用组织的 name/orgType 覆盖表单值——
  // 否则同一组织的不同岗会写出不同的公司名，公司主页就散了。
  let org: { id: string; name: string; orgType: OrgType } | null = null;
  if (input.orgId) {
    await requireOrgMember(input.orgId, userId);
    org = await prisma.organization.findUnique({
      where: { id: input.orgId },
      select: { id: true, name: true, orgType: true },
    });
    if (!org) throw new ApiError(404, "org_not_found", "组织不存在");
  }

  const created = await prisma.jobPosting.create({
    data: {
      postedByUserId: userId,
      orgId: org?.id ?? null,
      orgType: org?.orgType ?? null,
      posterRole: input.posterRole,
      companyStage: input.companyStage,
      company: org?.name ?? input.company,
      title: input.title,
      location: input.location || null,
      salary: input.salary || null,
      description: input.description,
      url: input.url || null,
      referralCode: input.referralCode || null,
      categories: input.categories as unknown as Prisma.InputJsonValue,
      status: input.status,
      // 草稿不进审核队列；提交发布的一律 pending，过审后才进候选端（与用户录入岗位同一治理口径）
      reviewStatus: "pending",
    },
    select: { id: true, status: true, reviewStatus: true },
  });
  return ok(created, 201);
});
