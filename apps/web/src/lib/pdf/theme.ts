import { StyleSheet } from "@react-pdf/renderer";

// 版式主题：把“字体族 / 字号 / 纸张 / 页边距”统一应用到所有 react-pdf 模板。
// 模板从 resume["x-theme"] 读取（落库持久化），也可由导出路由用 query 参数临时覆盖。

export type ThemeFontKey = "sc" | "jp" | "latin";

export const FONT_FAMILY: Record<ThemeFontKey, string> = {
  sc: "NotoSansSC", // 思源黑体（中日通用，含简体专有名词）
  jp: "NotoSansJP", // 思源黑体 JP（日式字形最优）
  latin: "Helvetica", // react-pdf 内置，仅 Latin，无 CJK
};

export type ThemeInput = {
  font?: ThemeFontKey;
  fontScale?: number;
  paper?: "a4" | "letter";
  margin?: number;
};

export type ResolvedTheme = {
  font: string;
  fontScale: number;
  paper: "A4" | "LETTER";
  pagePadding: number;
};

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

// defaultFont：模板的“天然”默认字体（日文模板传 "jp"，其余传 "sc"）。
// 用户显式选了 font 时以用户为准。
export function resolveTheme(
  resume: { "x-theme"?: Record<string, unknown> } | undefined,
  defaultFont: ThemeFontKey = "sc",
): ResolvedTheme {
  const th = (resume?.["x-theme"] ?? {}) as Partial<ThemeInput>;
  const fontKey = (th.font as ThemeFontKey) ?? defaultFont;
  const font = FONT_FAMILY[fontKey] ?? FONT_FAMILY[defaultFont];
  const fontScale = clamp(Number(th.fontScale ?? 1) || 1, 0.85, 1.3);
  const paper = (th.paper ?? "a4") === "letter" ? "LETTER" : "A4";
  const pagePadding = Number(th.margin ?? 44) || 44;
  return { font, fontScale, paper, pagePadding };
}

const num = (v: unknown): number | undefined => (typeof v === "number" ? v : undefined);

// 把主题应用到一组样式：所有 fontSize 乘以 fontScale，page 的字体族/页边距按主题覆盖。
// 同时兼容驼峰(fontSize)与连字符(font-size)键名。
export function themedStyles<T extends Record<string, Record<string, unknown>>>(raw: T, th: ResolvedTheme): Record<keyof T, any> {
  const out: Record<string, Record<string, unknown>> = {};
  for (const [key, style] of Object.entries(raw)) {
    const ns: Record<string, unknown> = { ...style };
    const fs = num(ns.fontSize) ?? num(ns["font-size"]);
    if (typeof fs === "number") {
      const scaled = Math.round(fs * th.fontScale * 100) / 100;
      if ("fontSize" in ns) ns.fontSize = scaled;
      else ns["font-size"] = scaled;
    }
    if (key === "page") {
      ns.fontFamily = th.font;
      ns.padding = th.pagePadding;
    }
    out[key] = ns;
  }
  return StyleSheet.create(out as never) as unknown as Record<keyof T, any>;
}
