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

/** 根据 Accept-Language 请求头，从受支持的语言中协商出最合适的 locale。 */
export function negotiateLocale(acceptLanguage: string | null | undefined): Locale {
  if (!acceptLanguage) return DEFAULT_LOCALE;

  type Candidate = { tag: string; q: number };
  const candidates: Candidate[] = acceptLanguage
    .split(",")
    .map((part) => {
      const [rawTag, rawQ] = part.trim().split(";").map((s) => s.trim());
      const tag = (rawTag || "").toLowerCase();
      const q = rawQ ? parseFloat(rawQ.replace(/^q=/i, "")) : 1;
      return { tag, q: Number.isFinite(q) ? q : 0 };
    })
    .filter((c) => c.tag && c.q > 0);

  let best: Locale = DEFAULT_LOCALE;
  let bestScore = -1;

  for (const { tag, q } of candidates) {
    for (const locale of LOCALES.map((l) => l.code)) {
      const score = matchLocaleScore(tag, locale);
      if (score <= 0) continue;
      const weighted = score * q;
      if (weighted > bestScore) {
        bestScore = weighted;
        best = locale;
      }
    }
  }

  return best;
}

function matchLocaleScore(tag: string, locale: string): number {
  const loc = locale.toLowerCase();

  // 中文特殊处理：简化字/繁体字/地区码
  if (loc === "zh-cn") {
    if (tag === "zh-cn" || tag === "zh-hans" || tag === "zh") return 1;
  }
  if (loc === "zh-tw") {
    if (tag === "zh-tw" || tag === "zh-hant" || tag === "zh-hk" || tag === "zh-mo") return 1;
  }

  // 完全匹配，如 "en-us" -> "en-us"（如果支持）或 "ja-jp" -> "ja"
  if (tag === loc) return 1;
  if (tag === loc.split("-")[0]) return 0.5;
  return 0;
}
