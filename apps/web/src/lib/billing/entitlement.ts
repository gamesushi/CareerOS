// 组织订阅权益读取（仅查库，不引入 stripe SDK，保持可在 edge 安全导入）。
//
// 订阅状态 → 权益的单一事实来源。发岗配额闸门（lib/limits.ts）与前端订阅面板都从这里取数。

import { prisma } from "@careeros/db";
import { FREE_ACTIVE_POSTING_LIMIT, getPlan, type BillingPlan } from "./plans";

export interface OrgEntitlement {
  isSubscribed: boolean;
  status: string | null; // active | trialing | past_due | canceled | ...
  plan: BillingPlan | null;
  /** 当前档位允许的最大「在招(open)」岗位数。 */
  maxActivePostings: number;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
}

/** 读取某组织的订阅行（无则 null）。 */
export async function getOrgSubscription(orgId: string) {
  return prisma.organizationSubscription.findUnique({ where: { orgId } });
}

/**
 * 计算组织权益。
 * - 视为「已订阅」：status 为 active 或 trialing（即使 cancelAtPeriodEnd=true，也持续到周期末）。
 * - 未订阅或已取消：套用免费档在招岗上限。
 */
export async function getOrgEntitlement(orgId: string | null | undefined): Promise<OrgEntitlement> {
  const base: OrgEntitlement = {
    isSubscribed: false,
    status: null,
    plan: null,
    maxActivePostings: FREE_ACTIVE_POSTING_LIMIT,
    currentPeriodEnd: null,
    cancelAtPeriodEnd: false,
  };
  if (!orgId) return base;

  const sub = await getOrgSubscription(orgId);
  if (!sub) return base;

  const isSubscribed = sub.status === "active" || sub.status === "trialing";
  const plan = getPlan(sub.planSlug) ?? null;
  return {
    isSubscribed,
    status: sub.status,
    plan,
    maxActivePostings: isSubscribed && plan ? plan.maxActivePostings : FREE_ACTIVE_POSTING_LIMIT,
    currentPeriodEnd: sub.currentPeriodEnd,
    cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
  };
}
