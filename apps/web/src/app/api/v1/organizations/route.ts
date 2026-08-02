// 组织：GET 我所属的 / POST 新建（建者自动成为 owner）。

import { organizationCreateInput, slugify, EMPLOYER_ROLES } from "@careeros/shared";
import { handler, ok, parseBody, requireRole } from "@/lib/api";
import { createOrganization, listMyOrganizations, uniqueSlug } from "@/lib/organizations";

const NEED_EMPLOYER = "需要招聘者权限，请在「账号设置」中开启发岗";

export const GET = handler(async () => {
  const { userId } = await requireRole(EMPLOYER_ROLES, NEED_EMPLOYER);
  return ok({ data: await listMyOrganizations(userId) });
});

export const POST = handler(async (req) => {
  const { userId } = await requireRole(EMPLOYER_ROLES, NEED_EMPLOYER);
  const input = await parseBody(req, organizationCreateInput);

  // 用户没填 slug 就从名字派生；无论哪种都过一次去重（撞车加 -2、-3…）
  const slug = await uniqueSlug(input.slug || slugify(input.name));

  const org = await createOrganization(userId, {
    slug,
    name: input.name,
    orgType: input.orgType,
    website: input.website || null,
    logoUrl: input.logoUrl || null,
    description: input.description || null,
    industry: input.industry || null,
    size: input.size || null,
    location: input.location || null,
  });
  return ok(org, 201);
});
