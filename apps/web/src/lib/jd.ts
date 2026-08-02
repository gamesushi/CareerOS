/** 简单剥离 HTML 标签，保留换行可读性 */
export function stripHtml(html: string): string {
  if (!html) return "";
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** 从不同来源的 raw 数据里尽量提取完整 JD */
export function extractFullJd(raw: unknown, snippet?: string | null): string {
  if (!raw || typeof raw !== "object") return snippet ?? "";
  const r = raw as Record<string, unknown>;

  const pick = (...keys: string[]) => {
    for (const k of keys) {
      const v = r[k];
      if (typeof v === "string" && v.trim().length > 0) return v.trim();
    }
    return undefined;
  };

  // 各来源常见字段：description / content 是 HTML；descriptionPlain / requirement / responsibility 是纯文本
  const htmlOrText =
    pick("descriptionPlain", "description", "content", "requirement", "responsibility", "jobDescription") ??
    snippet ??
    "";

  return stripHtml(htmlOrText);
}
