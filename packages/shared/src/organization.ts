import { z } from "zod";

// 组织实体契约（Phase 2）。组织是「公司主页 + 岗位归属」这一层，
// 与 JobPosting 共用 OrgType 词表（见 job-posting.ts）。

export const ORG_SIZES = ["1-10", "11-50", "51-200", "200+"] as const;

/** slug 规则：小写字母数字与连字符，首尾必须是字母数字，2-64 位。 */
export const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,62}[a-z0-9]$/;

/**
 * 由组织名生成 slug 候选值。
 * 中文名等生成不出 ascii 的情况回落为 org-<随机>，让用户在表单里自行改写——
 * 好过硬塞一串拼音或直接报错。
 */
export function slugify(name: string, randomSuffix = () => Math.random().toString(36).slice(2, 10)): string {
  const base = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{ASCII}]/gu, "") // 去掉中日韩等非 ascii
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 56);
  if (base.length >= 2 && SLUG_RE.test(base)) return base;
  return `org-${randomSuffix()}`;
}

export const organizationCreateInput = z.object({
  name: z.string().trim().min(2, "组织名至少 2 个字符").max(160),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(SLUG_RE, "只能用小写字母、数字和连字符，且首尾为字母或数字")
    .max(64)
    .optional(),
  // 公司资料页不再展示「发布主体」选择，统一默认创业公司；仍保留字段供 API/旧数据兼容
  orgType: z.enum(["individual_hr", "startup", "non_company_team"]).optional().default("startup"),
  website: z.string().trim().url("请填写合法网址").max(255).optional().or(z.literal("")),
  logoUrl: z.string().trim().url("请填写合法图片地址").max(2000).optional().or(z.literal("")),
  description: z.string().trim().max(5000).optional(),
  industry: z.string().trim().max(64).optional(),
  size: z.enum(ORG_SIZES).optional(),
  location: z.string().trim().max(128).optional(),
});

export type OrganizationInput = z.infer<typeof organizationCreateInput>;

/** 编辑：全字段可选，但给了就按同样规则校验。 */
export const organizationUpdateInput = organizationCreateInput.partial();
