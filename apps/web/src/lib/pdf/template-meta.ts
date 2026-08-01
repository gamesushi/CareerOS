// 模板元数据：客户端安全（不引入 react-pdf），编辑器/生成对话框共用。
// 组件映射在 registry.ts（仅服务端）。

export type TemplateMeta = {
  id: string;
  name: string;
  description: string;
  defaultAccent: string;
  langs?: ("zh" | "en" | "ja_shokumu" | "ja_rirekisho")[];
};

export const TEMPLATE_META: TemplateMeta[] = [
  { id: "classic", name: "经典", description: "单栏黑白，稳妥通用", defaultAccent: "#222222", langs: ["zh", "en"] },
  { id: "modern", name: "现代", description: "强调色横线与标题，外企风", defaultAccent: "#2563eb", langs: ["zh", "en"] },
  { id: "sidebar", name: "侧栏", description: "双栏+时间线，信息密度高", defaultAccent: "#0f766e", langs: ["zh", "en"] },
  { id: "compact", name: "紧凑", description: "居中极简，一页装下更多", defaultAccent: "#525252", langs: ["zh", "en"] },
  { id: "ats", name: "ATS 英文", description: "美式求职优化，单栏无图，关键词友好", defaultAccent: "#111111", langs: ["en"] },
  { id: "shokumu", name: "職務経歴書", description: "日本転職標準・会社別テーブル", defaultAccent: "#333333", langs: ["ja_shokumu"] },
  { id: "rirekisho", name: "履歴書", description: "JIS 様式・表形式（写真枠付）", defaultAccent: "#333333", langs: ["ja_rirekisho"] },
];

/** resumeType → 推荐默认模板 */
export const TYPE_DEFAULT_TEMPLATE: Record<string, string> = {
  en: "ats",
  ja_shokumu: "shokumu",
  ja_rirekisho: "rirekisho",
};

export function filterTemplatesForType(resumeType?: string): TemplateMeta[] {
  if (!resumeType) return TEMPLATE_META;
  const filtered = TEMPLATE_META.filter((t) => !t.langs || t.langs.includes(resumeType as any));
  return filtered.length > 0 ? filtered : TEMPLATE_META;
}

export function resolveTemplateMeta(templateId: string | null | undefined): TemplateMeta {
  const id = templateId?.replace(/^openresume-/, "") ?? "classic";
  return TEMPLATE_META.find((t) => t.id === id) ?? TEMPLATE_META[0];
}
