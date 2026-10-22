// Stripe 操作封装：懒加载客户端、Stripe Customer 取/建、Checkout 会话、Billing Portal 会话，
// 以及把 Stripe 订阅对象幂等落库到 OrganizationSubscription。
//
// 所有「副作用」都走 upsert（按 stripeSubscriptionId 幂等），Webhook 重复投递也安全。

import Stripe from "stripe";
import { prisma } from "@careeros/db";
import { ApiError } from "@/lib/errors";
import { getPlan, getPlanByPriceId } from "./plans";

// stripe SDK 仅在 Node 运行时使用；本模块不要被 edge runtime 路由直接 import。

let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new ApiError(500, "stripe_not_configured", "Stripe 未配置（缺少 STRIPE_SECRET_KEY）");
  }
  if (!_stripe) {
    // apiVersion 固定为 SDK 内置版本，避免 SDK 升级后默认版本漂移导致类型/字段不一致。
    _stripe = new Stripe(key, { apiVersion: "2025-08-27.basil", typescript: true });
  }
  return _stripe;
}

/** 应用对外 base URL：用于拼接 success/cancel/return 回跳地址。 */
function appBaseUrl(): string {
  if (process.env.APP_BASE_URL) return process.env.APP_BASE_URL.replace(/\/$/, "");
  return process.env.NODE_ENV === "production" ? "https://ucareeros.com" : "http://localhost:3000";
}

/** 取/建组织对应的 Stripe Customer，并把 customer id 持久化到 Organization。 */
export async function getOrCreateStripeCustomer(orgId: string): Promise<{ customerId: string }> {
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: {
      id: true,
      name: true,
      stripeCustomerId: true,
      members: { where: { role: "owner" }, take: 1, select: { userId: true } },
    },
  });
  if (!org) throw new ApiError(404, "org_not_found", "组织不存在");
  if (org.stripeCustomerId) return { customerId: org.stripeCustomerId };

  let email: string | undefined;
  const owner = org.members[0];
  if (owner) {
    const u = await prisma.user.findUnique({ where: { id: owner.userId }, select: { email: true } });
    email = u?.email;
  }

  const customer = await getStripe().customers.create({
    name: org.name,
    email,
    metadata: { orgId: org.id },
  });
  await prisma.organization.update({
    where: { id: org.id },
    data: { stripeCustomerId: customer.id },
  });
  return { customerId: customer.id };
}

/** 创建订阅结账会话（Hosted Checkout，跳 Stripe 官方页）。返回可重定向的 url。 */
export async function createCheckoutSession(
  orgId: string,
  _userId: string,
  planSlug: string,
): Promise<{ url: string }> {
  const plan = getPlan(planSlug);
  if (!plan) throw new ApiError(400, "unknown_plan", "未知套餐");
  const priceId = process.env[plan.priceIdEnv];
  if (!priceId) {
    throw new ApiError(500, "stripe_price_missing", `Stripe 价格未配置（缺少 ${plan.priceIdEnv}）`);
  }

  const { customerId } = await getOrCreateStripeCustomer(orgId);
  const base = appBaseUrl();
  const session = await getStripe().checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    allow_promotion_codes: true,
    metadata: { orgId, planSlug },
    success_url: `${base}/employer/company?billing=success`,
    cancel_url: `${base}/employer/company?billing=cancel`,
  });
  if (!session.url) throw new ApiError(500, "stripe_session_url_missing", "Stripe 未返回结账地址");
  return { url: session.url };
}

/** 创建 Billing Portal 会话（用户自助改支付方式 / 取消订阅）。返回可重定向的 url。 */
export async function createPortalSession(orgId: string): Promise<{ url: string }> {
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { stripeCustomerId: true },
  });
  if (!org?.stripeCustomerId) throw new ApiError(400, "no_customer", "该组织尚未创建 Stripe 客户");
  const session = await getStripe().billingPortal.sessions.create({
    customer: org.stripeCustomerId,
    return_url: `${appBaseUrl()}/employer/company`,
  });
  return { url: session.url };
}

export interface SubscriptionUpsertParams {
  orgId: string;
  stripeCustomerId: string;
  stripeSubscriptionId: string;
  stripePriceId: string;
  planSlug: string;
  status: string;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
}

/** 把 Stripe 订阅状态幂等写入本地（按 stripeSubscriptionId upsert）。 */
export async function upsertSubscription(p: SubscriptionUpsertParams): Promise<void> {
  await prisma.organizationSubscription.upsert({
    where: { stripeSubscriptionId: p.stripeSubscriptionId },
    create: {
      orgId: p.orgId,
      stripeCustomerId: p.stripeCustomerId,
      stripeSubscriptionId: p.stripeSubscriptionId,
      stripePriceId: p.stripePriceId,
      planSlug: p.planSlug,
      status: p.status,
      currentPeriodStart: p.currentPeriodStart,
      currentPeriodEnd: p.currentPeriodEnd,
      cancelAtPeriodEnd: p.cancelAtPeriodEnd,
    },
    update: {
      stripePriceId: p.stripePriceId,
      planSlug: p.planSlug,
      status: p.status,
      currentPeriodStart: p.currentPeriodStart,
      currentPeriodEnd: p.currentPeriodEnd,
      cancelAtPeriodEnd: p.cancelAtPeriodEnd,
    },
  });
}

/**
 * 从 Stripe 订阅对象 + 已知 orgId/planSlug 构造落库参数。
 * 注：本 SDK 版本的 TS 类型未暴露 `current_period_start/end`（API 仍返回），
 * 故此处用受控 cast 读取这两个字段。
 */
export function subscriptionToParams(
  sub: Stripe.Subscription,
  orgId: string,
  planSlug: string,
): SubscriptionUpsertParams {
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
  const priceId = sub.items.data[0]?.price.id ?? "";
  const raw = sub as unknown as { current_period_start?: number; current_period_end?: number };
  return {
    orgId,
    stripeCustomerId: customerId,
    stripeSubscriptionId: sub.id,
    stripePriceId: priceId,
    planSlug,
    status: sub.status,
    currentPeriodStart: new Date((raw.current_period_start ?? 0) * 1000),
    currentPeriodEnd: new Date((raw.current_period_end ?? 0) * 1000),
    cancelAtPeriodEnd: sub.cancel_at_period_end,
  };
}

/** 由 Price ID 推断 planSlug（Webhook 中 subscription 无 metadata 时回退用）。 */
export function resolvePlanSlug(priceId: string | undefined | null, fallback = "pro"): string {
  return getPlanByPriceId(priceId)?.slug ?? fallback;
}
