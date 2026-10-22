// 读取组织订阅与权益。组织任意成员可查看（用于前端订阅面板展示）。
//
// GET /api/v1/billing/subscription?orgId=xxx
// 返回 OrgEntitlement：{ isSubscribed, status, plan, maxActivePostings, currentPeriodEnd, cancelAtPeriodEnd }

import { handler, ok, requireUser } from "@/lib/api";
import { ApiError } from "@/lib/errors";
import { requireOrgMember } from "@/lib/organizations";
import { getOrgEntitlement } from "@/lib/billing/entitlement";

export const GET = handler(async (req) => {
  const { userId } = await requireUser();
  const orgId = new URL(req.url).searchParams.get("orgId");
  if (!orgId) throw new ApiError(400, "missing_org_id", "缺少 orgId 参数");
  await requireOrgMember(orgId, userId);
  const entitlement = await getOrgEntitlement(orgId);
  return ok(entitlement);
});
