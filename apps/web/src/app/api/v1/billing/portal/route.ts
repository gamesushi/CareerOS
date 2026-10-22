// 创建 Billing Portal 会话（用户自助改支付方式 / 取消订阅）。仅组织 owner/admin 可发起。
//
// POST /api/v1/billing/portal  body: { orgId }
// 返回 { url } —— 前端 302 跳转到 Stripe Customer Portal。

import { z } from "zod";
import { handler, ok, parseBody, requireUser } from "@/lib/api";
import { requireOrgMember } from "@/lib/organizations";
import { createPortalSession } from "@/lib/billing/stripe";

const schema = z.object({
  orgId: z.string().uuid(),
});

export const POST = handler(async (req) => {
  const { userId } = await requireUser();
  const { orgId } = await parseBody(req, schema);
  await requireOrgMember(orgId, userId, ["owner", "admin"]);
  const { url } = await createPortalSession(orgId);
  return ok({ url });
});
