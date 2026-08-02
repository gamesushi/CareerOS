// 组织实体的查询与成员门禁。
//
// 权限分三层，与仓库既有分层一致：
//   1. 角色层 requireRole(EMPLOYER_ROLES)——不是招聘者根本进不来（lib/api.ts）
//   2. 成员层 requireOrgMember——写组织 / 以组织名义发岗，必须是该组织成员（本文件）
//   3. 归属层 postedByUserId——改岗仍校验发布者本人（job-postings 路由）

import { prisma, type Prisma, type OrgMemberRole } from "@careeros/db";
import { slugify, SLUG_RE } from "@careeros/shared";
import { ApiError } from "@/lib/errors";
import { PUBLIC_POSTING_WHERE } from "@/lib/job-postings";

const ORG_SELECT = {
  id: true,
  slug: true,
  name: true,
  orgType: true,
  logoUrl: true,
  website: true,
  description: true,
  industry: true,
  size: true,
  location: true,
  verified: true,
} satisfies Prisma.OrganizationSelect;

/**
 * 成员门禁：不是成员（或角色不够）一律 403。
 * 注意与 requireRole 的区别——requireRole 管「能不能发岗」，这里管「能不能动这家组织」。
 */
export async function requireOrgMember(
  orgId: string,
  userId: string,
  roles?: readonly OrgMemberRole[],
): Promise<OrgMemberRole> {
  const member = await prisma.organizationMember.findUnique({
    where: { orgId_userId: { orgId, userId } },
    select: { role: true },
  });
  if (!member) throw new ApiError(403, "not_org_member", "你不是该组织的成员");
  if (roles && !roles.includes(member.role)) {
    throw new ApiError(403, "forbidden", "该操作需要组织管理员权限");
  }
  return member.role;
}

/** 我所属的组织（含我在其中的角色）。 */
export async function listMyOrganizations(userId: string) {
  const rows = await prisma.organizationMember.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
    select: { role: true, org: { select: ORG_SELECT } },
  });
  return rows.map((r) => ({ ...r.org, myRole: r.role }));
}

/**
 * slug 去重：候选值被占用时依次加 -2、-3…（而不是抛 409 让用户自己想）。
 * excludeOrgId 用于编辑场景——改别的字段时 slug 没变，不该跟自己冲突。
 */
export async function uniqueSlug(desired: string, excludeOrgId?: string): Promise<string> {
  const base = SLUG_RE.test(desired) ? desired : slugify(desired);
  for (let i = 1; i < 50; i++) {
    const candidate = i === 1 ? base : `${base.slice(0, 60)}-${i}`;
    const taken = await prisma.organization.findUnique({
      where: { slug: candidate },
      select: { id: true },
    });
    if (!taken || taken.id === excludeOrgId) return candidate;
  }
  // 50 次仍撞车（几乎不可能）：退回随机 slug，保证建组织这条路不会因为重名断掉
  return slugify("", () => Math.random().toString(36).slice(2, 10));
}

/** 建组织 + 把创建者写成 owner 成员。必须同事务，否则可能出现「没有成员的孤儿组织」。 */
export async function createOrganization(
  userId: string,
  data: Omit<Prisma.OrganizationUncheckedCreateInput, "slug"> & { slug: string },
) {
  return prisma.$transaction(async (tx) => {
    const org = await tx.organization.create({ data, select: ORG_SELECT });
    await tx.organizationMember.create({
      data: { orgId: org.id, userId, role: "owner" },
    });
    return org;
  });
}

/** 公开公司主页：组织资料 + 该组织已过审在招岗位。免登录访问，故只出可公开字段。 */
export async function getPublicOrganization(slug: string) {
  const org = await prisma.organization.findUnique({
    where: { slug },
    select: { ...ORG_SELECT, createdAt: true },
  });
  if (!org) return null;

  const postings = await prisma.jobPosting.findMany({
    // 复用候选端同一套可见性闸门（open + approved + 未下架），避免两处逻辑漂移
    where: { ...PUBLIC_POSTING_WHERE, orgId: org.id },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      title: true,
      location: true,
      salary: true,
      description: true,
      url: true,
      categories: true,
      createdAt: true,
    },
  });
  return { org, postings };
}
