// i18n 配置：受支持的语言与默认语言。
// 语言由 cookie 驱动（LOCALE_COOKIE），可即时切换且在服务端可读（用于 <html lang>）。

export const LOCALE_COOKIE = "careeros_locale";

export type Locale =
  | "zh-CN"
  | "en"
  | "ja"
  | "zh-TW"
  | "ko"
  | "fr"
  | "de"
  | "es"
  | "pt"
  | "ru"
  | "it";

export interface LocaleMeta {
  /** 内部 locale code，同时用作消息文件名 */
  code: Locale;
  /** 该语言的母语名称（用于切换器展示） */
  label: string;
  /** <html lang> 使用的 BCP-47 标签 */
  htmlLang: string;
}

export const LOCALES: LocaleMeta[] = [
  { code: "zh-CN", label: "简体中文", htmlLang: "zh-Hans" },
  { code: "en", label: "English", htmlLang: "en" },
  { code: "ja", label: "日本語", htmlLang: "ja" },
  { code: "zh-TW", label: "繁體中文", htmlLang: "zh-Hant" },
  { code: "ko", label: "한국어", htmlLang: "ko" },
  { code: "fr", label: "Français", htmlLang: "fr" },
  { code: "de", label: "Deutsch", htmlLang: "de" },
  { code: "es", label: "Español", htmlLang: "es" },
  { code: "pt", label: "Português", htmlLang: "pt" },
  { code: "ru", label: "Русский", htmlLang: "ru" },
  { code: "it", label: "Italiano", htmlLang: "it" },
];

export const DEFAULT_LOCALE: Locale = "zh-CN";

const LOCALE_CODES = new Set<string>(LOCALES.map((l) => l.code));

export function isLocale(value: string | undefined | null): value is Locale {
  return !!value && LOCALE_CODES.has(value);
}

export function normalizeLocale(value: string | undefined | null): Locale {
  if (isLocale(value)) return value;
  // 兼容旧的 "zh" 存量值
  if (value === "zh") return "zh-CN";
  return DEFAULT_LOCALE;
}

export function htmlLangFor(locale: Locale): string {
  return LOCALES.find((l) => l.code === locale)?.htmlLang ?? "en";
}
