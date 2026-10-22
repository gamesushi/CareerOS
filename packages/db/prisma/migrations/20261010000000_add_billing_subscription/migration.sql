-- 为 B 端组织订阅（Stripe）新增字段与表。
-- 对应 schema.prisma：Organization.stripeCustomerId、OrganizationSubscription、StripeWebhookEvent。

-- 1) Organization 增加 Stripe Customer 字段 + 索引
ALTER TABLE "organizations" ADD COLUMN "stripe_customer_id" VARCHAR(255);
CREATE INDEX "organizations_stripe_customer_id_idx" ON "organizations"("stripe_customer_id");

-- 2) 组织订阅表（一个组织一行）
CREATE TABLE "organization_subscriptions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "org_id" UUID NOT NULL,
    "stripe_customer_id" VARCHAR(255) NOT NULL,
    "stripe_subscription_id" VARCHAR(255) NOT NULL,
    "stripe_price_id" VARCHAR(255) NOT NULL,
    "plan_slug" VARCHAR(64) NOT NULL,
    "status" VARCHAR(32) NOT NULL,
    "current_period_start" TIMESTAMPTZ(3) NOT NULL,
    "current_period_end" TIMESTAMPTZ(3) NOT NULL,
    "cancel_at_period_end" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organization_subscriptions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "organization_subscriptions_org_id_key" ON "organization_subscriptions"("org_id");
CREATE UNIQUE INDEX "organization_subscriptions_stripe_subscription_id_key" ON "organization_subscriptions"("stripe_subscription_id");
CREATE INDEX "organization_subscriptions_stripe_customer_id_idx" ON "organization_subscriptions"("stripe_customer_id");

ALTER TABLE "organization_subscriptions" ADD CONSTRAINT "organization_subscriptions_org_id_fkey"
    FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 3) Stripe Webhook 幂等表（event id 主键）
CREATE TABLE "stripe_webhook_events" (
    "id" TEXT NOT NULL,
    "type" VARCHAR(64) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stripe_webhook_events_pkey" PRIMARY KEY ("id")
);
