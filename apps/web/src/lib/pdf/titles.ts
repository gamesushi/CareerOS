// 简历分区标题与内联文案的本地化字典（与导出格式无关，PDF / Markdown / Doc / Docx 共用）。
// 之前分区标题散落在各导出器里写死中文，英文/日文简历会错位；集中在此处按 resumeType 取用。
// 新增语言或简历类型时，在此一处维护即可。

export type SectionKey =
  | "summary"
  | "work"
  | "projects"
  | "skills"
  | "education"
  | "awards"
  | "languages";

export const SECTION_TITLES: Record<string, Record<SectionKey, string>> = {
  zh: {
    summary: "个人综述",
    work: "工作经历",
    projects: "项目经历",
    skills: "技能",
    education: "教育经历",
    awards: "主要成果",
    languages: "语言能力",
  },
  en: {
    summary: "Summary",
    work: "Experience",
    projects: "Projects",
    skills: "Skills",
    education: "Education",
    awards: "Achievements",
    languages: "Languages",
  },
  ja_shokumu: {
    summary: "職務要約",
    work: "職務経歴",
    projects: "プロジェクト",
    skills: "スキル",
    education: "学歴",
    awards: "主な実績",
    languages: "語学力",
  },
  // 履歴書（JIS 様式）沿用日语分区语义，避免回退到中文标题
  ja_rirekisho: {
    summary: "志望動機",
    work: "職歴",
    projects: "プロジェクト",
    skills: "スキル",
    education: "学歴",
    awards: "免許・資格",
    languages: "語学力",
  },
  // LinkedIn / 求职信 / CV 等以英文文书为主
  linkedin: {
    summary: "Summary",
    work: "Experience",
    projects: "Projects",
    skills: "Skills",
    education: "Education",
    awards: "Achievements",
    languages: "Languages",
  },
  cover_letter: {
    summary: "Summary",
    work: "Experience",
    projects: "Projects",
    skills: "Skills",
    education: "Education",
    awards: "Achievements",
    languages: "Languages",
  },
  cv: {
    summary: "Summary",
    work: "Experience",
    projects: "Projects",
    skills: "Skills",
    education: "Education",
    awards: "Publications & Achievements",
    languages: "Languages",
  },
};

export const titlesFor = (lang?: string): Record<SectionKey, string> =>
  SECTION_TITLES[lang ?? "zh"] ?? SECTION_TITLES.zh;

/** 分区之外、散落在条目内的小标签（时间段「至今」、枚举分隔符、关键词前缀、缺省文档名）。 */
export type InlineLabels = {
  present: string;
  enumSep: string; // 同一行内多值枚举（如 roles：A、B）
  groupSep: string; // 教育等子字段拼接（studyType，area，score）
  keywords: string;
  fallbackName: string;
};

export const inlineLabels = (lang?: string): InlineLabels => {
  const l = lang ?? "zh";
  if (l === "en" || l === "cv" || l === "linkedin" || l === "cover_letter") {
    return { present: "Present", enumSep: ", ", groupSep: ", ", keywords: "Keywords: ", fallbackName: "Resume" };
  }
  if (l.startsWith("ja")) {
    return { present: "現在", enumSep: "、", groupSep: "、", keywords: "キーワード：", fallbackName: "履歴書" };
  }
  return { present: "至今", enumSep: "、", groupSep: "，", keywords: "关键词：", fallbackName: "简历" };
};

/** 是否为「CV」（长版学术/欧洲简历，不限页数）；其余类型按简历惯例控制篇幅。 */
export const isCvType = (resumeType?: string | null): boolean => resumeType === "cv";
