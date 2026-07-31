import { z } from "zod";
import { experienceInput, projectInput, skillInput, achievementInput, educationInput } from "./entities";

// ===== resumeParse 任务的 LLM 输出契约（docs/design/04-ai-workflows.md §1） =====
// 日期宽松收集（YYYY / YYYY-MM / YYYY-MM-DD），由 normalizeExtractedDate 统一补全，
// 缺月补 -01 并降置信度的规则在 worker 侧执行。

export const looseDate = z
  .string()
  .regex(/^\d{4}(-\d{2})?(-\d{2})?$/)
  .nullable()
  .optional();

export const confidence = z.enum(["high", "mid", "low"]);

export const extractedExperience = z.object({
  company: z.string().min(1).max(128),
  title: z.string().min(1).max(128),
  startDate: looseDate,
  startDatePrecision: z.enum(["year", "month", "day"]).nullable().optional(),
  endDate: looseDate,
  endDatePrecision: z.enum(["year", "month", "day"]).nullable().optional(),
  location: z.string().max(128).nullable().optional(),
  description: z.string().max(20000).nullable().optional(),
  highlights: z.array(z.string().max(500)).default([]),
  confidence,
});

export const extractedProject = z.object({
  name: z.string().min(1).max(160),
  role: z.string().max(128).nullable().optional(),
  startDate: looseDate,
  startDatePrecision: z.enum(["year", "month", "day"]).nullable().optional(),
  endDate: looseDate,
  endDatePrecision: z.enum(["year", "month", "day"]).nullable().optional(),
  description: z.string().max(20000).nullable().optional(),
  outcome: z.string().max(20000).nullable().optional(),
  techStack: z.array(z.string().max(80)).default([]),
  belongsToCompany: z.string().max(128).nullable().optional(),
  confidence,
});

export const extractedSkill = z.object({
  name: z.string().min(1).max(80),
  category: z.enum(["language", "framework", "tool", "domain", "soft"]).nullable().optional(),
  evidenceHint: z.string().max(500).nullable().optional(), // 原文出处片段
});

export const extractedAchievement = z.object({
  title: z.string().min(1).max(200),
  metricValue: z.number().nullable().optional(),
  metricUnit: z.string().max(32).nullable().optional(),
  metricText: z.string().max(120).nullable().optional(),
  context: z.string().max(500).nullable().optional(),
});

export const extractedEducation = z.object({
  school: z.string().min(1).max(160),
  degree: z.string().max(64).nullable().optional(),
  major: z.string().max(128).nullable().optional(),
  startDate: looseDate,
  startDatePrecision: z.enum(["year", "month", "day"]).nullable().optional(),
  endDate: looseDate,
  endDatePrecision: z.enum(["year", "month", "day"]).nullable().optional(),
});

export const extractionResult = z.object({
  basics: z
    .object({
      name: z.string().max(128).nullable().optional(),
      email: z.string().max(255).nullable().optional(),
      phone: z.string().max(64).nullable().optional(),
      location: z.string().max(128).nullable().optional(),
      links: z.array(z.string().max(500)).default([]),
      summary: z.string().max(4000).nullable().optional(),
    })
    .default({ links: [] }),
  experiences: z.array(extractedExperience).default([]),
  projects: z.array(extractedProject).default([]),
  skills: z.array(extractedSkill).default([]),
  achievements: z.array(extractedAchievement).default([]),
  educations: z.array(extractedEducation).default([]),
});

export type ExtractionResult = z.infer<typeof extractionResult>;

export type DatePrecision = "year" | "month" | "day";

/** 宽松日期 → YYYY-MM-DD + 原始精度。缺月/缺日补 01；返回 padded 标记供降置信度。 */
export function normalizeExtractedDate(d: string | null | undefined): {
  date: string | null;
  precision: DatePrecision | null;
  padded: boolean;
} {
  if (!d) return { date: null, precision: null, padded: false };
  if (/^\d{4}$/.test(d)) return { date: `${d}-01-01`, precision: "year", padded: true };
  if (/^\d{4}-\d{2}$/.test(d)) return { date: `${d}-01`, precision: "month", padded: true };
  return { date: d, precision: "day", padded: false };
}

// ===== 确认页提交（apply）契约：复用实体输入 schema =====
export const applyImportInput = z.object({
  experiences: z.array(experienceInput).default([]),
  // 项目通过 belongsToCompany 在服务端匹配刚创建/已存在的经历
  projects: z.array(projectInput.extend({ belongsToCompany: z.string().nullable().optional() })).default([]),
  skills: z.array(skillInput).default([]),
  achievements: z.array(achievementInput).default([]),
  educations: z.array(educationInput).default([]),
});

export type ApplyImportInput = z.infer<typeof applyImportInput>;

// 存进 resume_imports.extracted 的完整结构（LLM 结果 + 查重标注）
export const extractedPayload = z.object({
  result: extractionResult,
  duplicates: z
    .object({
      experiences: z.array(z.object({ index: z.number(), existingId: z.string(), existingLabel: z.string() })),
      skills: z.array(z.object({ index: z.number(), existingId: z.string(), existingLabel: z.string() })),
    })
    .default({ experiences: [], skills: [] }),
  promptVersion: z.string(),
  model: z.string(),
});

export type ExtractedPayload = z.infer<typeof extractedPayload>;
