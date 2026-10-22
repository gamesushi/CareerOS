# uCareerOS × Stripe 接入与联调说明

B 端组织月费订阅（Hosted Checkout + Stripe Billing + Customer Portal）。

## 1. 环境变量

`.env`（与 `.env.example`）已新增以下变量，请填入真实值：

| 变量 | 说明 |
| --- | --- |
| `STRIPE_SECRET_KEY` | Stripe 后台 → Developers → API keys → Secret key（`sk_live_` / `sk_test_`） |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | 同页面下的 Publishable key（`pk_live_` / `pk_test_`）；本集成走 Hosted Checkout，前端不直接用，但建议配齐 |
| `STRIPE_WEBHOOK_SECRET` | Webhook 签名密钥（见第 3 步） |
| `STRIPE_BEND_PRICE_ID` | B 端 Pro 套餐在 Stripe 的 Price ID（见第 2 步） |

> 生产建议同时设 `APP_BASE_URL=https://ucareeros.com`，否则回跳地址默认走该域名。

## 2. 在 Stripe 后台创建 Pro 套餐 Price

1. Stripe 后台 → Product catalog → **Create product**，名称如 "uCareerOS Pro 招聘会员"，选 **Recurring**（月费）。
2. 记下生成的 **Price ID**（形如 `price_1Nxxxx`）。
3. 把该 Price ID 填进 `.env` 的 `STRIPE_BEND_PRICE_ID`。
4. 多档套餐：在 `apps/web/src/lib/billing/plans.ts` 加一项（slug + `priceIdEnv` 指向新的 `STRIPE_<SLUG>_PRICE_ID`），并在 `.env.example` 补对应变量即可。

## 3. Webhook 端点

- 代码端点：`apps/web/src/app/api/stripe/webhook/route.ts`，生产地址 `https://ucareeros.com/api/stripe/webhook`。
- Stripe 后台 → Developers → Webhooks → **Add endpoint**，填上述 URL，订阅事件：
  - `checkout.session.completed`
  - `customer.subscription.created`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
- 创建后复制 **Signing secret**（`whsec_...`）填进 `.env` 的 `STRIPE_WEBHOOK_SECRET`。

## 4. 本地联调（stripe-cli 转发）

```bash
# 1) 安装并登录 stripe-cli
brew install stripe/stripe-cli/stripe
stripe login

# 2) 终端 A：起 web 服务（dev）
pnpm --filter web dev          # 默认 http://localhost:3000

# 3) 终端 B：把 Stripe 事件转发到本地 webhook
stripe listen --forward-to localhost:3000/api/stripe/webhook
# 输出里的 `whsec_...` 临时填到本地 .env 的 STRIPE_WEBHOOK_SECRET

# 4) 用 test key + 测试卡（4242 4242 4242 4242）走一遍：
#    订阅 Pro → 跳 Stripe 测试结账页 → 支付成功 → webhook 自动开通订阅
```

> 测试环境用 `sk_test_` 与 `whsec_`（stripe listen 生成的临时 secret）。上线切 live 时换成 `sk_live_` 与后台 Webhook 的正式 secret。

## 5. 数据库迁移

迁移已生成（未执行，因无本地 DB）：`packages/db/prisma/migrations/20261010000000_add_billing_subscription/migration.sql`。

在数据库可用时执行（任选其一）：

```bash
# 推荐：走 migrate 体系（会记录到 _prisma_migrations）
pnpm --filter db prisma migrate deploy

# 或仅执行该 SQL（幂等 DDL）
psql "$DATABASE_URL" -f packages/db/prisma/migrations/20261010000000_add_billing_subscription/migration.sql
```

新增内容：
- `organizations.stripe_customer_id`
- `organization_subscriptions`（一个组织一行，订阅状态/周期）
- `stripe_webhook_events`（event id 主键，防 Stripe 重复投递重复开通）

## 6. 权益闸门（已接）

- 免费组织：最多 **5** 个在招(open)岗位；Pro：最多 **100**。
- 发岗 POST 路由在原有「每人每日 10 岗」之上叠加「组织档位在招岗上限」校验，超额返回 403 并提示升级。
- 默认值在 `apps/web/src/lib/billing/plans.ts`（`FREE_ACTIVE_POSTING_LIMIT` / `maxActivePostings`）可调。

## 7. 前端入口

雇主「公司资料」页（`/employer/company`）底部新增「订阅与账单」面板：
- 未订阅：展示 Pro 权益 + 「订阅 Pro（月费）」按钮（跳 Hosted Checkout）。
- 生效中/试用：展示到期日 + 「管理订阅 / 支付方式」（跳 Stripe Customer Portal）。
- `past_due`：红色警告 + 引导更新支付方式。
- 回跳 `?billing=success|cancel` 弹对应 toast。
