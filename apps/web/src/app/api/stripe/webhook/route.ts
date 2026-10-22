// Stripe Webhook 接收端点。生产配置：https://ucareeros.com/api/stripe/webhook
//
// 关键坑（Next.js App Router）：
//  - 必须用 Node runtime（stripe SDK 非 edge 兼容）。
//  - 必须读取「原始 body」文本，不能让框架把 JSON 解析掉，否则验签失败。
//  - 验签用 STRIPE_WEBHOOK_SECRET + 请求头 stripe-signature。
//  - 处理成功后再记幂等记录；失败返回 500 让 Stripe 重试（upsert 保证重试幂等）。

import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { prisma } from "@careeros/db";
import { getStripe, subscriptionToParams, upsertSubscription, resolvePlanSlug } from "@/lib/billing/stripe";

export const runtime = "nodejs";
// Webhook 不需要静态优化；明确动态。
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "webhook_not_configured" }, { status: 500 });
  }
  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: "stripe_not_configured" }, { status: 500 });
  }
  const sig = req.headers.get("stripe-signature");
  if (!sig) {
    return NextResponse.json({ error: "missing_signature" }, { status: 400 });
  }

  const rawBody = await req.text();
  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(rawBody, sig, secret);
  } catch {
    return NextResponse.json({ error: "invalid_signature" }, { status: 400 });
  }

  // 幂等：已成功处理过的 event 直接 200，避免 Stripe 重投递重复开通。
  const seen = await prisma.stripeWebhookEvent.findUnique({ where: { id: event.id } }).catch(() => null);
  if (seen) {
    return NextResponse.json({ received: true, duplicate: true });
  }

  try {
    await handleEvent(event);
  } catch (err) {
    // 处理失败：返回 500，Stripe 会按退避策略重试；不在此时写幂等记录，便于重试。
    console.error("[stripe webhook] handle failed", { eventId: event.id, type: event.type, err });
    return NextResponse.json({ error: "handle_failed" }, { status: 500 });
  }

  // 成功后再落幂等记录。
  await prisma.stripeWebhookEvent.create({ data: { id: event.id, type: event.type } }).catch(() => {});
  return NextResponse.json({ received: true });
}

async function handleEvent(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      // 我们只关心订阅型结账；一次性结账（若有）在此忽略。
      if (session.mode !== "subscription" || !session.subscription) return;
      const orgId = session.metadata?.orgId;
      const planSlug = session.metadata?.planSlug ?? "pro";
      if (!orgId) {
        console.error("[stripe webhook] checkout.session.completed 缺少 orgId", event.id);
        return;
      }
      const subRef = session.subscription;
      const subId = typeof subRef === "string" ? subRef : (subRef as Stripe.Subscription | null)?.id;
      if (!subId) {
        console.error("[stripe webhook] checkout.session.completed 缺少 subscription", event.id);
        return;
      }
      const sub = await getStripe().subscriptions.retrieve(subId);
      await upsertSubscription(subscriptionToParams(sub, orgId, planSlug));
      break;
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
      const org = await prisma.organization.findFirst({
        where: { stripeCustomerId: customerId },
        select: { id: true },
      });
      if (!org) {
        console.error("[stripe webhook] 找不到 customer 对应的组织", { customerId, eventId: event.id });
        return;
      }
      const priceId = sub.items.data[0]?.price.id ?? "";
      const planSlug = resolvePlanSlug(priceId);
      await upsertSubscription(subscriptionToParams(sub, org.id, planSlug));
      break;
    }
    // invoice.paid / invoice.payment_failed 等：订阅状态由上面的 subscription.* 事件覆盖，
    // 这里无需额外处理（past_due 也会经 subscription.updated 落到本地）。
    default:
      break;
  }
}
