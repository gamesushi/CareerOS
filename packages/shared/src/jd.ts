import { z } from "zod";

// JD 解析结果契约（job_descriptions.parsed，docs/design/01 §2）

export const jdParsed = z.object({
  company: z.string().max(128).nullable().optional(),
  title: z.string().max(160).nullable().optional(),
  skills: z
    .array(
      z.object({
        name: z.string().min(1).max(80),
        required: z.boolean().default(true),
        weight: z.number().int().min(1).max(5).default(3),
      }),
    )
    .default([]),
  experience: z
    .array(z.object({ desc: z.string().max(500), yearsMin: z.number().int().nullable().optional() }))
    .default([]),
  industry: z.array(z.string().max(64)).default([]),
  keywords: z.array(z.string().max(64)).default([]),
  languages: z.array(z.string().max(32)).default([]),
  seniority: z.string().max(32).nullable().optional(),
  location: z.string().max(128).nullable().optional(),
  salaryRange: z.string().max(128).nullable().optional(),
});

export type JdParsed = z.infer<typeof jdParsed>;

// 匹配打分常量（docs/design/01 §3.2；集中一处便于调参）
export const MATCH_WEIGHTS = { skill: 0.5, experience: 0.3, industry: 0.2 };
export const SKILL_SIM_THRESHOLD = 0.85; // 名称未命中时的向量兜底阈值
export const EXP_SIM_FULL = 0.8; // ≥ 记满分
export const EXP_SIM_ZERO = 0.65; // < 记零分，中间线性

export const jdImportInput = z
  .object({
    text: z.string().max(100_000).optional(),
    url: z.string().url().optional(),
    company: z.string().max(128).optional(),
    title: z.string().max(160).optional(),
  })
  .refine((v) => v.text || v.url, { message: "text 与 url 至少提供一个（文件走 multipart）" });

export type JdImportInput = z.infer<typeof jdImportInput>;
