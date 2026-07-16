import { z } from "zod";

// API 契约与 docs/design/02-api-design.md 的 OpenAPI Schema 一一对应。
// 日期一律 "YYYY-MM-DD" 字符串，由 API 层转 Date。

export const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "格式须为 YYYY-MM-DD");
export const langEnum = z.enum(["zh", "en", "ja"]);

export const experienceInput = z
  .object({
    company: z.string().min(1).max(128),
    title: z.string().min(1).max(128),
    employmentType: z.enum(["fulltime", "contract", "intern", "freelance"]).optional(),
    startDate: dateStr,
    endDate: dateStr.nullable().optional(),
    location: z.string().max(128).optional(),
    description: z.string().max(20000).optional(),
    highlights: z.array(z.string().max(500)).default([]),
    lang: langEnum.default("zh"),
    sortOrder: z.number().int().default(0),
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
});

export const educationInput = z.object({
  school: z.string().min(1).max(160),
  degree: z.string().max(64).optional(),
  major: z.string().max(128).optional(),
  startDate: dateStr.nullable().optional(),
  endDate: dateStr.nullable().optional(),
  gpa: z.string().max(16).optional(),
  description: z.string().max(4000).optional(),
  sortOrder: z.number().int().default(0),
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

export const meUpdateInput = z.object({
  name: z.string().min(1).max(128).optional(),
  avatarUrl: z.string().url().nullable().optional(),
  locale: langEnum.optional(),
  region: z.string().max(64).nullable().optional(),
  languages: z.array(langEnum).optional(),
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
