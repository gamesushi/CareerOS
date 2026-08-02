import { z } from "zod";

// B 端雇主发岗契约。与 C 端岗位监测（watch.ts）共用品类词表 JOB_CATEGORIES，
// 保证发布岗与抓取岗在候选端能用同一套品类筛选。

// 发布主体类型。enterprise 已在 DB 枚举里预留，但首期表单不可选
// （大企多有自有 ATS，需求弱；等有组织实体 Organization 再启用）。
export const ORG_TYPES = [
  { id: "individual_hr", label: "HR 个人" },
  { id: "startup", label: "创业公司" },
  { id: "non_company_team", label: "创业团队" },
] as const;

export const orgTypeIds = ORG_TYPES.map((o) => o.id) as unknown as [string, ...string[]];

/** 可发岗的角色。以 DB 里的 role 为准判定（见 api.ts requireRole），不信任 JWT 快照。 */
export const EMPLOYER_ROLES = ["recruiter", "enterprise", "admin"] as const;

export const jobPostingCreateInput = z.object({
  /** 以组织名义发布时传组织 id；服务端会校验成员身份，并用组织名覆盖 company。 */
  orgId: z.string().uuid().optional(),
  orgType: z.enum(["individual_hr", "startup", "non_company_team"]),
  company: z.string().trim().min(2, "公司/团队名至少 2 个字符").max(128),
  title: z.string().trim().min(2, "职位名称至少 2 个字符").max(200),
  location: z.string().trim().max(128).optional(),
  salary: z.string().trim().max(64).optional(),
  // 最低字数是最基础的反垃圾门槛：一句话的「招人，私聊」挡在门外
  description: z.string().trim().min(30, "岗位描述至少 30 个字符").max(20_000),
  url: z.string().trim().url("请填写合法的申请链接").max(2000).optional().or(z.literal("")),
  categories: z.array(z.enum(["game", "finance", "tech", "ai"])).max(4).default([]),
  /** draft = 存草稿（不进审核队列）；open = 提交发布（进审核队列）。 */
  status: z.enum(["draft", "open"]).default("open"),
});

export type JobPostingInput = z.infer<typeof jobPostingCreateInput>;

/** 发布者可改的状态：下架（closed）/ 重开（open）/ 存回草稿（draft）。 */
export const jobPostingStatusInput = z.object({
  status: z.enum(["draft", "open", "closed"]),
});
