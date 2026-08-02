// 改组织资料。需 owner / admin 成员身份（recruiter 成员只能发岗，不能改公司门面）。

import { prisma } from "@careeros/db";
import { organizationUpdateInput, EMPLOYER_ROLES } from "@careeros/shared";
import { handler, ok, parseBody, requireRole } from "@/lib/api";
import { requireOrgMember, uniqueSlug } from "@/lib/organizations";

export const PATCH = handler(async (req, { params }) => {
  const { userId } = await requireRole(EMPLOYER_ROLES);
  const { id } = await params;
  await requireOrgMember(id, userId, ["owner", "admin"]);

  const input = await parseBody(req, organizationUpdateInput);
  // 改 slug 时排除自己，否则「没改 slug 只改别的字段」会被自己占用的值顶成 -2
  const slug = input.slug ? await uniqueSlug(input.slug, id) : undefined;

  const org = await prisma.organization.update({
    where: { id },
    data: {
      ...(slug ? { slug } : {}),
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.orgType !== undefined ? { orgType: input.orgType } : {}),
      ...(input.website !== undefined ? { website: input.website || null } : {}),
      ...(input.logoUrl !== undefined ? { logoUrl: input.logoUrl || null } : {}),
      ...(input.description !== undefined ? { description: input.description || null } : {}),
      ...(input.industry !== undefined ? { industry: input.industry || null } : {}),
      ...(input.size !== undefined ? { size: input.size || null } : {}),
      ...(input.location !== undefined ? { location: input.location || null } : {}),
    },
    select: { id: true, slug: true, name: true },
  });
  return ok(org);
});
