// 语言映射：把 User.locale / i18n locale 解析为「生成用目标语言」标签。
// 所有需要按用户语言生成自然语言的 AI 任务都应调用本文件，避免输出语言错乱
// （典型 bug：prompt 用中文写，模型就把 headline/summary 也生成中文，即使数据是日文）。

export type LangInfo = { code: string; label: string };

const MAP: Record<string, LangInfo> = {
  ja: { code: "ja", label: "日本語" },
  "ja-JP": { code: "ja", label: "日本語" },
  en: { code: "en", label: "English" },
  "en-US": { code: "en", label: "English" },
  "en-GB": { code: "en", label: "English" },
  zh: { code: "zh", label: "简体中文" },
  "zh-CN": { code: "zh", label: "简体中文" },
  "zh-TW": { code: "zh", label: "繁體中文" },
  "zh-Hant": { code: "zh", label: "繁體中文" },
};

export function localeToLanguage(locale: string | null | undefined): LangInfo {
  if (!locale) return MAP.zh;
  return MAP[locale] ?? MAP.zh;
}

// i18n locale（UI 语言）可能是 11 种之一，但生成类路由只支持 zh/en/ja 三档，
// 这里归并到最近的受支持语言，供前端默认语言选择器使用。
export function normalizeDocLang(locale: string | null | undefined): "zh" | "en" | "ja" {
  const code = localeToLanguage(locale).code;
  if (code === "ja") return "ja";
  if (code === "en") return "en";
  return "zh";
}
