// 可复用的抓取基础工具：统一的 fetch + 解析助手。
// 设计目标：新增站点时只需关心「如何把响应映射成 SourceJob」，
// 网络/编码/正则提取等脏活都收敛到这里。无第三方依赖（纯 Node fetch + 正则）。

import { UA } from "../types";

export type FetchOpts = {
  headers?: Record<string, string>;
  timeout?: number;
  method?: string;
  body?: string;
};

/** 取 JSON，非 2xx 抛错（由 watchPoll 捕获并记录）。 */
export async function fetchJson<T = unknown>(url: string, opts: FetchOpts = {}): Promise<T> {
  const res = await fetch(url, {
    method: opts.method ?? "GET",
    body: opts.body,
    headers: { "User-Agent": UA, Accept: "application/json", ...opts.headers },
    signal: AbortSignal.timeout(opts.timeout ?? 20_000),
  });
  if (!res.ok) throw new Error(`${url} HTTP ${res.status}`);
  return (await res.json()) as T;
}

/** 取 HTML 文本。 */
export async function fetchHtml(url: string, opts: FetchOpts = {}): Promise<string> {
  const res = await fetch(url, {
    headers: {
      "User-Agent": UA,
      Accept: "text/html,application/xhtml+xml",
      ...opts.headers,
    },
    signal: AbortSignal.timeout(opts.timeout ?? 20_000),
  });
  if (!res.ok) throw new Error(`${url} HTTP ${res.status}`);
  return await res.text();
}

/** HTML/富文本 → 纯文本（去标签、去实体、压缩空白）。 */
export function stripHtml(s?: string): string {
  return (s ?? "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * 在 HTML 中按正则提取所有「第一个捕获组」内容（防御式，无匹配返回空数组）。
 * 自动保证全局标志并防止零宽匹配死循环。
 */
export function extractAll(re: RegExp, html: string): string[] {
  const out: string[] = [];
  const g = new RegExp(re.source, re.flags.includes("g") ? re.flags : re.flags + "g");
  let m: RegExpExecArray | null;
  while ((m = g.exec(html)) !== null) {
    if (m[1] !== undefined) out.push(m[1].trim());
    if (g.lastIndex === m.index) g.lastIndex++;
  }
  return out;
}
