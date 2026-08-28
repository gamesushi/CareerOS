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
  // 个人照片（base64 data URL，前端压缩后写入；rirekisho 等模板渲染照片框）
  photo: z.string().max(4_000_000).optional(),
  // 通用联系地址（rirekisho/shokumu 模板使用；日本履历书也可用 x-jis.address）
  address: z.string().max(300).optional(),
  // 社交/主页链接（对照应聘表单 SNS 区块）：LinkedIn / 知乎 / 个人站 等
  profiles: z
    .array(z.object({ network: z.string().max(64), url: z.string().max(500), username: z.string().max(128).optional() }))
    .default([]),
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
  // 模型偶发把熟练度写成数字（受事实包「熟练度80」影响），按 mock 约定归一成中文文字
  level: z
    .union([z.string(), z.number()])
    .nullable()
    .transform((v) =>
      v == null ? undefined : typeof v === "number" ? (v >= 80 ? "精通" : v >= 60 ? "熟练" : "掌握") : v,
    )
    .optional(),
  keywords: z.array(z.union([z.string(), z.number()]).transform(String)).default([]),
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
    .array(
      z.object({
        title: z.string().max(200),
        issuer: z.string().max(160).optional(), // 颁发机构（Honor.issuer）
        date: z.string().max(10).optional(),
        summary: z.string().max(500).optional(),
      }),
    )
    .default([]),
  "x-warnings": z.array(z.string().max(300)).default([]),
  "x-theme": z
    .object({
      accent: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(), // 模板强调色，缺省用模板默认
      // 版式自定义（标准范围）
      font: z.enum(["sc", "jp", "latin"]).optional(), // sc=思源黑体(中日) jp=思源黑体JP latin=Helvetica
      fontScale: z.number().min(0.85).max(1.3).optional(), // 字号缩放倍率
      paper: z.enum(["a4", "letter"]).optional(), // 纸张尺寸
      margin: z.number().min(20).max(80).optional(), // 页边距(pt)
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
  // 段可见性开关：用户在编辑器逐段控制是否出现在导出/预览的 PDF 中。
  // 缺省（字段不存在或 true）= 显示；false = 隐藏。隐藏仅影响渲染，不删除数据。
  "x-sections": z
    .object({
      work: z.boolean().optional(),
      projects: z.boolean().optional(),
      skills: z.boolean().optional(),
      education: z.boolean().optional(),
      awards: z.boolean().optional(),
    })
    .optional(),
  // 程序化/种子数据透传的扩展字段（非 JSON Resume 标准键，以 x- 命名空间保留）
  "x-meta": z
    .object({
      languages: z.array(z.string().max(120)).default([]), // 语言能力清单，ATS 模板单独成区
    })
    .optional(),
});

export type JsonResume = z.infer<typeof jsonResume>;

/**
 * 估算简历页数（启发式，非精确排版）：用于编辑器中「超过两页」预警。
 * 仅按文本体量粗算，CV 不限制页数由调用方判断。
 */
export function estimateResumePages(r: JsonResume): number {
  const bulletLines = (s: string) => Math.max(1, Math.ceil(s.length / 95));
  let lines = 3; // 头部 + 联系方式
  if (r.basics?.summary) lines += Math.ceil(r.basics.summary.length / 110) + 1;
  for (const w of r.work ?? []) {
    lines += 2;
    lines += w.summary ? bulletLines(w.summary) : 0;
    lines += (w.highlights ?? []).reduce((a, h) => a + bulletLines(h), 0);
  }
  for (const p of r.projects ?? []) {
    lines += 2;
    lines += p.description ? bulletLines(p.description) : 0;
    lines += (p.highlights ?? []).reduce((a, h) => a + bulletLines(h), 0);
  }
  lines += (r.education ?? []).length * 2;
  lines += Math.ceil((r.skills ?? []).length / 5); // 约 5 个/行
  lines += (r.awards ?? []).length;
  const LINES_PER_PAGE = 46; // 紧凑 A4 单页约 46 行（9~10pt）
  return Math.max(1, Math.ceil(lines / LINES_PER_PAGE));
}

export const resumeGenerateInput = z.object({
  jdId: z.string().uuid().nullable().optional(),
  resumeType: z.enum(["zh", "en", "ja_shokumu", "ja_rirekisho", "cv"]).default("zh"),
  templateId: z.string().max(64).default("classic"),
  emphasis: z.array(z.string().max(64)).default([]), // 用户希望突出的方向
});

export type ResumeGenerateInput = z.infer<typeof resumeGenerateInput>;
