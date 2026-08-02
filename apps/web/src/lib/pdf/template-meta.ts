// 模板元数据：客户端安全（不引入 react-pdf），编辑器/生成对话框共用。
// 组件映射在 registry.ts（仅服务端）。

export type LangGroup = "zh" | "en" | "ja";

export type TemplateMeta = {
  id: string;
  name: string;
  description: string;
  defaultAccent: string;
  langGroup: LangGroup;
  langs?: ("zh" | "en" | "ja_shokumu" | "ja_rirekisho")[];
};

export const TEMPLATE_META: TemplateMeta[] = [
  { id: "classic", name: "经典", description: "单栏黑白，稳妥通用", defaultAccent: "#222222", langGroup: "zh", langs: ["zh", "en", "ja_shokumu", "ja_rirekisho"] },
  { id: "modern", name: "现代", description: "强调色横线与标题，外企风", defaultAccent: "#2563eb", langGroup: "zh", langs: ["zh", "en", "ja_shokumu", "ja_rirekisho"] },
  { id: "sidebar", name: "侧栏", description: "双栏+时间线，信息密度高", defaultAccent: "#0f766e", langGroup: "zh", langs: ["zh", "en", "ja_shokumu", "ja_rirekisho"] },
  { id: "compact", name: "紧凑", description: "居中极简，一页装下更多", defaultAccent: "#525252", langGroup: "zh", langs: ["zh", "en", "ja_shokumu", "ja_rirekisho"] },
  { id: "ats", name: "ATS 英文", description: "美式求职优化，单栏无图，关键词友好", defaultAccent: "#111111", langGroup: "en", langs: ["en"] },
  { id: "shokumu", name: "職務経歴書", description: "日本転職標準・会社別テーブル", defaultAccent: "#333333", langGroup: "ja", langs: ["ja_shokumu"] },
  { id: "rirekisho", name: "履歴書", description: "JIS 様式・表形式（写真枠付）", defaultAccent: "#333333", langGroup: "ja", langs: ["ja_rirekisho"] },
];

export const LANG_GROUP_LABELS: Record<LangGroup, string> = {
  zh: "中文通用样式",
  en: "英文美式样式",
  ja: "日文标准样式",
};

/** resumeType → 推荐默认模板 */
export const TYPE_DEFAULT_TEMPLATE: Record<string, string> = {
  zh: "classic",
  en: "ats",
  ja_shokumu: "shokumu",
  ja_rirekisho: "rirekisho",
};

export function filterTemplatesForType(resumeType?: string): TemplateMeta[] {
  if (!resumeType) return TEMPLATE_META;
  const filtered = TEMPLATE_META.filter((t) => !t.langs || t.langs.includes(resumeType as "zh" | "en" | "ja_shokumu" | "ja_rirekisho"));
  return filtered.length > 0 ? filtered : TEMPLATE_META;
}

export function resolveTemplateMeta(templateId: string | null | undefined): TemplateMeta {
  const id = templateId?.replace(/^openresume-/, "") ?? "classic";
  return TEMPLATE_META.find((t) => t.id === id) ?? TEMPLATE_META[0];
}

export function getTemplatesGroupedByLang() {
  return [
    { group: "zh", label: LANG_GROUP_LABELS.zh, items: TEMPLATE_META.filter((t) => t.langGroup === "zh") },
    { group: "en", label: LANG_GROUP_LABELS.en, items: TEMPLATE_META.filter((t) => t.langGroup === "en") },
    { group: "ja", label: LANG_GROUP_LABELS.ja, items: TEMPLATE_META.filter((t) => t.langGroup === "ja") },
  ];
}
