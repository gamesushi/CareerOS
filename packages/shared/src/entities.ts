import { z } from "zod";

// API 契约与 docs/design/02-api-design.md 的 OpenAPI Schema 一一对应。
// 日期一律 "YYYY-MM-DD" 字符串，由 API 层转 Date。

export const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "格式须为 YYYY-MM-DD");
export const langEnum = z.enum(["zh", "en", "ja"]);

export const experienceInput = z
  .object({
    company: z.string().min(1).max(128),
    department: z.string().max(128).optional(),
    title: z.string().min(1).max(128),
    employmentType: z.enum(["fulltime", "contract", "intern", "freelance"]).optional(),
    startDate: dateStr,
    endDate: dateStr.nullable().optional(),
    location: z.string().max(128).optional(),
    description: z.string().max(20000).optional(),
    highlights: z.array(z.string().max(500)).default([]),
    lang: langEnum.default("zh"),
    sortOrder: z.number().int().default(0),
    // 查重合并：提供 mergeIntoId 则更新该已入库经历（enriched），forceCreate 则强制新建
    mergeIntoId: z.string().uuid().nullable().optional(),
    forceCreate: z.boolean().optional(),
  })
  .refine((v) => !v.endDate || v.endDate >= v.startDate, {
    message: "结束日期不能早于开始日期",
    path: ["endDate"],
  });

export const projectInput = z.object({
  experienceId: z.string().uuid().nullable().optional(),
  name: z.string().min(1).max(160),
  role: z.string().max(128).optional(),
  startDate: dateStr.nullable().optional(),
  endDate: dateStr.nullable().optional(),
  description: z.string().max(20000).optional(),
  outcome: z.string().max(20000).optional(),
  links: z.array(z.object({ label: z.string().max(80), url: z.string().url() })).default([]),
  techStack: z.array(z.string().max(80)).default([]),
  lang: langEnum.default("zh"),
  skillIds: z.array(z.string().uuid()).default([]),
  sortOrder: z.number().int().default(0),
  // 查重合并：提供 mergeIntoId 则更新该已入库项目，forceCreate 则强制新建
  mergeIntoId: z.string().uuid().nullable().optional(),
  forceCreate: z.boolean().optional(),
});

export const skillInput = z.object({
  name: z.string().min(1).max(80),
  category: z.enum(["language", "framework", "tool", "domain", "soft"]).optional(),
  level: z.number().int().min(0).max(100).optional(),
});

export const skillEvidenceInput = z.object({
  sourceType: z.enum(["project", "experience", "work_log", "achievement", "certificate", "external"]),
  sourceId: z.string().uuid().nullable().optional(),
  note: z.string().max(2000).optional(),
  url: z.string().url().nullable().optional(),
  weight: z.number().int().min(1).max(5).default(1),
});

export const achievementInput = z.object({
  title: z.string().min(1).max(200),
  metricValue: z.number().nullable().optional(),
  metricUnit: z.string().max(32).nullable().optional(),
  metricText: z.string().max(120).nullable().optional(),
  evidence: z.string().max(4000).optional(),
  experienceId: z.string().uuid().nullable().optional(),
  projectId: z.string().uuid().nullable().optional(),
  occurredAt: dateStr.nullable().optional(),
  // 查重合并：提供 mergeIntoId 则更新该已入库成果，forceCreate 则强制新建
  mergeIntoId: z.string().uuid().nullable().optional(),
  forceCreate: z.boolean().optional(),
});

export const educationInput = z.object({
  school: z.string().min(1).max(160),
  degree: z.string().max(64).optional(),
  major: z.string().max(128).optional(),
  faculty: z.string().max(160).optional(),
  startDate: dateStr.nullable().optional(),
  endDate: dateStr.nullable().optional(),
  gpa: z.string().max(16).optional(),
  description: z.string().max(4000).optional(),
  sortOrder: z.number().int().default(0),
  // 查重合并：提供 mergeIntoId 则更新该已入库教育，forceCreate 则强制新建
  mergeIntoId: z.string().uuid().nullable().optional(),
  forceCreate: z.boolean().optional(),
});

export const honorInput = z.object({
  title: z.string().min(1).max(200),
  issuer: z.string().max(160).optional(),
  date: dateStr.nullable().optional(),
  description: z.string().max(2000).optional(),
  sortOrder: z.number().int().default(0),
  // 查重合并：提供 mergeIntoId 则更新该已入库荣誉，forceCreate 则强制新建
  mergeIntoId: z.string().uuid().nullable().optional(),
  forceCreate: z.boolean().optional(),
});

export const workLogInput = z.object({
  logDate: dateStr,
  title: z.string().min(1).max(200),
  content: z.string().min(1).max(50000),
  tags: z.array(z.string().max(40)).default([]),
  projectIds: z.array(z.string().uuid()).default([]),
  skillIds: z.array(z.string().uuid()).default([]),
});

export const privacySettings = z.object({
  profile_public: z.boolean(),
  resume_searchable: z.boolean(),
  recruiter_contact: z.boolean(),
  feed_visible: z.boolean(),
});

export const personalInput = z.object({
  photo: z.string().max(4_000_000).optional(),
  address: z.string().max(300).optional(),
  furigana: z.string().max(64).optional(),
  birthDate: z.string().max(24).optional(),
});
export type PersonalInput = z.infer<typeof personalInput>;

export const meUpdateInput = z.object({
  name: z.string().min(1).max(128).optional(),
  image: z.string().url().nullable().optional(),
  locale: langEnum.optional(),
  region: z.string().max(64).nullable().optional(),
  mobile: z.string().max(64).nullable().optional(),
  preferredCity: z.string().max(128).nullable().optional(),
  headline: z.string().max(128).nullable().optional(),
  summary: z.string().nullable().optional(),
  personal: personalInput.optional(),
  workAuthStatus: z.enum(["us_authorized", "requires_sponsorship", "other"]).nullable().optional(),
  snsLinks: z
    .array(z.object({ network: z.string().max(40), url: z.string().max(500) }))
    .optional(),
  languages: z
    .array(z.object({ name: z.string().max(64), proficiency: z.string().max(40).optional() }))
    .optional(),
  jobStatus: z.enum(["open", "passive", "closed"]).optional(),
  privacy: privacySettings.partial().optional(),
});

export type ExperienceInput = z.infer<typeof experienceInput>;
export type ProjectInput = z.infer<typeof projectInput>;
export type SkillInput = z.infer<typeof skillInput>;
export type SkillEvidenceInput = z.infer<typeof skillEvidenceInput>;
export type AchievementInput = z.infer<typeof achievementInput>;
export type EducationInput = z.infer<typeof educationInput>;
export type WorkLogInput = z.infer<typeof workLogInput>;
export type MeUpdateInput = z.infer<typeof meUpdateInput>;
