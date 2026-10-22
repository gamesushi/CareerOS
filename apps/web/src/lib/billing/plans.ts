// B 端订阅套餐定义。
//
// 价格 ID 取自环境变量（在 Stripe 后台建 Price 后填入 .env 的对应变量）。
// 扩展多档套餐：在此加一项 + 在 .env.example 增加对应 `STRIPE_<SLUG>_PRICE_ID`。
//
// 注意：本文件是纯配置，不依赖 stripe SDK，可在任意运行时（含 edge）安全导入。

export interface BillingPlan {
  slug: string;
  name: string;
  /** 读取 `process.env[priceIdEnv]` 得到该套餐在 Stripe 的 Price ID。 */
  priceIdEnv: string;
  /** 该档位下组织「同时在招(open)」岗位上限。免费档由 FREE_ACTIVE_POSTING_LIMIT 控制。 */
  maxActivePostings: number;
  features: string[];
  highlighted?: boolean;
}

export const BILLING_PLANS: BillingPlan[] = [
  {
    slug: "pro",
    name: "Pro 招聘会员",
    priceIdEnv: "STRIPE_BEND_PRICE_ID",
    maxActivePostings: 100,
    highlighted: true,
    features: [
      "最多 100 个同时在招岗位",
      "组织公开主页 / 公司品牌页",
      "候选人投递收件箱与状态管理",
      "优先审核通道",
    ],
  },
];

/** 未订阅（免费）组织的在招岗上限。 */
export const FREE_ACTIVE_POSTING_LIMIT = 5;

export function getPlan(slug: string): BillingPlan | undefined {
  return BILLING_PLANS.find((p) => p.slug === slug);
}

/** 按 Stripe Price ID 反查套餐（Webhook 更新订阅状态时使用）。 */
export function getPlanByPriceId(priceId: string | undefined | null): BillingPlan | undefined {
  if (!priceId) return undefined;
  return BILLING_PLANS.find((p) => process.env[p.priceIdEnv] === priceId);
}
