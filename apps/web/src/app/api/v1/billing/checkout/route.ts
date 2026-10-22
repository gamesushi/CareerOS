// 创建订阅结账会话（Hosted Checkout）。仅组织 owner/admin 可发起。
//
// POST /api/v1/billing/checkout  body: { orgId, planSlug? }
// 返回 { url } —— 前端 302 跳转到 Stripe 官方结账页。

import { z } from "zod";
import { handler, ok, parseBody, requireUser } from "@/lib/api";
import { requireOrgMember } from "@/lib/organizations";
import { createCheckoutSession } from "@/lib/billing/stripe";

const schema = z.object({
  orgId: z.string().uuid(),
  planSlug: z.string().min(1).default("pro"),
});

export const POST = handler(async (req) => {
  const { userId } = await requireUser();
  const { orgId, planSlug } = await parseBody(req, schema);
  await requireOrgMember(orgId, userId, ["owner", "admin"]);
  const { url } = await createCheckoutSession(orgId, userId, planSlug);
  return ok({ url });
});
