import { z } from "zod";

// JSON Resume Schema（子集 + 扩展，docs/design/00 ADR-004）
// x-warnings：生成后事实包含性校验未命中的字段路径（编辑器黄色高亮）
// x-jis：日本職務経歴書扩展段（職務要約/自己PR），Sprint 4 预留结构

export const resumeBasics = z.object({
  name: z.string().max(128).default(""),
  label: z.string().max(160).optional(), // 职业定位一句话
  email: z.string().max(255).optional(),
  phone: z.string().max(64).optional(),
  location: z.string().max(128).optional(),
  summary: z.string().max(3000).optional(),
  url: z.string().max(500).optional(),
});

export const resumeWork = z.object({
  name: z.string().max(128), // 公司
  position: z.string().max(128),
  startDate: z.string().max(10).optional(), // YYYY-MM
  endDate: z.string().max(10).optional(), // 空 = 至今
  location: z.string().max(128).optional(),
  summary: z.string().max(2000).optional(),
  highlights: z.array(z.string().max(500)).default([]),
});

export const resumeProject = z.object({
  name: z.string().max(160),
  description: z.string().max(2000).optional(),
  highlights: z.array(z.string().max(500)).default([]),
  keywords: z.array(z.string().max(80)).default([]),
  roles: z.array(z.string().max(128)).default([]),
  startDate: z.string().max(10).optional(),
  endDate: z.string().max(10).optional(),
});

export const resumeSkill = z.object({
  name: z.string().max(80),
  level: z.string().max(32).optional(), // 展示用文字（熟练/精通）
  keywords: z.array(z.string().max(80)).default([]),
});

export const resumeEducation = z.object({
  institution: z.string().max(160),
  studyType: z.string().max(64).optional(), // 学位
  area: z.string().max(128).optional(), // 专业
  startDate: z.string().max(10).optional(),
  endDate: z.string().max(10).optional(),
  score: z.string().max(16).optional(),
});

export const jsonResume = z.object({
  basics: resumeBasics,
  work: z.array(resumeWork).default([]),
  projects: z.array(resumeProject).default([]),
  skills: z.array(resumeSkill).default([]),
  education: z.array(resumeEducation).default([]),
  awards: z
    .array(z.object({ title: z.string().max(200), date: z.string().max(10).optional(), summary: z.string().max(500).optional() }))
    .default([]),
  "x-warnings": z.array(z.string().max(300)).default([]),
  "x-theme": z
    .object({
      accent: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(), // 模板强调色，缺省用模板默认
    })
    .optional(),
  "x-jis": z
    .object({
      // 職務経歴書
      shokumuYoyaku: z.string().max(2000).optional(), // 職務要約
      ikaseruKeiken: z.array(z.string().max(300)).default([]), // 活かせる経験・知識
      jikoPR: z.string().max(2000).optional(), // 自己PR
      // 履歴書（JIS 様式）
      furigana: z.string().max(128).optional(), // 氏名ふりがな
      birthDate: z.string().max(10).optional(), // YYYY-MM-DD（用户在编辑器补填，AI 不得编造）
      address: z.string().max(300).optional(), // 現住所
      shiboudouki: z.string().max(1500).optional(), // 志望動機
      menkyoShikaku: z.array(z.object({ date: z.string().max(10).optional(), name: z.string().max(120) })).default([]), // 免許・資格
      honninKibou: z.string().max(500).optional(), // 本人希望記入欄
    })
    .optional(),
});

export type JsonResume = z.infer<typeof jsonResume>;

export const resumeGenerateInput = z.object({
  jdId: z.string().uuid().nullable().optional(),
  resumeType: z.enum(["zh", "en", "ja_shokumu", "ja_rirekisho"]).default("zh"),
  templateId: z.string().max(64).default("classic"),
  emphasis: z.array(z.string().max(64)).default([]), // 用户希望突出的方向
});

export type ResumeGenerateInput = z.infer<typeof resumeGenerateInput>;
