import { z } from "zod";
import { JOB_CATEGORY_IDS, ALL_CATEGORY_IDS } from "./watch";

// B 端雇主发岗契约。与 C 端岗位监测（watch.ts）共用品类词表 JOB_CATEGORIES，
// 保证发布岗与抓取岗在候选端能用同一套品类筛选。

// 组织类型（用于「公司资料」表单）。enterprise 已在 DB 枚举里预留，但首期表单不可选
// （大企多有自有 ATS，需求弱；等有组织实体 Organization 再启用）。
export const ORG_TYPES = [
  { id: "individual_hr", label: "HR 个人" },
  { id: "startup", label: "创业公司" },
  { id: "non_company_team", label: "创业团队" },
] as const;

export const orgTypeIds = ORG_TYPES.map((o) => o.id) as unknown as [string, ...string[]];

// 发布者身份：与 OrgType 解耦，同一家公司也可能是 HR / 用人经理 / 内推。
// 标签用第一人称口吻，区分三种不同诉求：我是 HR / 我要用人 / 我要内推。
export const POSTER_ROLES = [
  { id: "hr", label: "我是 HR" },
  { id: "hiring_manager", label: "我要用人" },
  { id: "employee_referral", label: "我要内推" },
] as const;

export const posterRoleIds = POSTER_ROLES.map((o) => o.id) as unknown as [string, ...string[]];

// 公司 / 团队成立年限
export const COMPANY_STAGES = [
  { id: "unregistered", label: "尚未注册" },
  { id: "startup_0_3", label: "0-3 年（初创期）" },
  { id: "growth_3_5", label: "3-5 年（成长期）" },
  { id: "stable_5_10", label: "5-10 年（稳定期）" },
  { id: "mature_10plus", label: "10 年以上（成熟期）" },
] as const;

export const companyStageIds = COMPANY_STAGES.map((o) => o.id) as unknown as [string, ...string[]];

/** 可发岗的角色。以 DB 里的 role 为准判定（见 api.ts requireRole），不信任 JWT 快照。 */
export const EMPLOYER_ROLES = ["recruiter", "enterprise", "admin"] as const;

export const jobPostingCreateInput = z.object({
  /** 以组织名义发布时传组织 id；服务端会校验成员身份，并用组织名覆盖 company。 */
  orgId: z.string().uuid().optional(),
  /** 组织发布时由服务端写入；个人发布时不再要求。 */
  orgType: z.enum(["individual_hr", "startup", "non_company_team"]).optional(),
  posterRole: z.enum(["hr", "hiring_manager", "employee_referral"]),
  companyStage: z.enum(["unregistered", "startup_0_3", "growth_3_5", "stable_5_10", "mature_10plus"]),
  company: z.string().trim().min(2, "公司/团队名至少 2 个字符").max(128),
  title: z.string().trim().min(2, "职位名称至少 2 个字符").max(200),
  location: z.string().trim().max(128).optional(),
  salary: z.string().trim().max(64).optional(),
  // 最低字数是最基础的反垃圾门槛：一句话的「招人，私聊」挡在门外
  description: z.string().trim().min(30, "岗位描述至少 30 个字符").max(20_000),
  url: z.string().trim().url("请填写合法的申请链接").max(2000).optional().or(z.literal("")),
  // 内推码：仅「我要内推」场景填写，供候选人投递时引用。可选。
  referralCode: z.string().trim().max(64, "内推码过长").optional().or(z.literal("")),
  // 一级品类（game/finance/tech/ai）+ 可选二级细分。存储时一级与二级并存，
  // 保证候选端按一级筛选（jobs/active、monitor）仍能命中。
  categories: z
    .array(z.string())
    .max(12, "最多选择 12 个品类")
    .default([])
    .refine((arr) => arr.every((x) => ALL_CATEGORY_IDS.includes(x)), "品类包含未知项")
    .refine((arr) => arr.some((x) => JOB_CATEGORY_IDS.includes(x)), "至少选择一个一级品类"),
  /** draft = 存草稿（不进审核队列）；open = 提交发布（进审核队列）。 */
  status: z.enum(["draft", "open"]).default("open"),
});

export type JobPostingInput = z.infer<typeof jobPostingCreateInput>;

/** 发布者可改的状态：下架（closed）/ 重开（open）/ 存回草稿（draft）。 */
export const jobPostingStatusInput = z.object({
  status: z.enum(["draft", "open", "closed"]),
});
