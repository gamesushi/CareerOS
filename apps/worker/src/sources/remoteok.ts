import type { JobSource, SourceJob } from "./types";
import { UA } from "./types";

// RemoteOK（remoteok.com）— 全球远程职位聚合站。
// 公开 JSON 接口：GET /api?tags=<keyword> 返回职位数组（首条常为 legal 元信息，需过滤）。
// 反爬弱，带上浏览器 UA 即可；是"全球/远程"来源里最稳的一个。

type RokJob = {
  id?: string | number | null;
  position?: string;
  company?: string;
  location?: string;
  url?: string;
  apply_url?: string;
  salary?: string;
  description?: string;
  date?: number; // unix 秒
  tags?: string[];
};

const stripHtml = (s?: string) =>
  (s ?? "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

export const remoteokSource: JobSource = {
  id: "remoteok",
  label: "RemoteOK",
  async search(keyword: string): Promise<SourceJob[]> {
    const url = `https://remoteok.com/api?tags=${encodeURIComponent(keyword)}`;
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "application/json" },
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) throw new Error(`remoteok HTTP ${res.status}`);
    const list = (await res.json()) as RokJob[];
    if (!Array.isArray(list)) throw new Error("remoteok: unexpected body");

    return list
      .filter((j) => j && j.id && j.position)
      // RemoteOK /api 一次性返回匹配标签的全部岗位；2000 作安全上限实现"抓取全量"。
      .slice(0, 2000)
      .map((j) => ({
        externalId: `remoteok-${j.id}`,
        title: j.position!,
        company: j.company,
        location: j.location,
        salary: j.salary,
        url: j.url || j.apply_url || `https://remoteok.com/remote-jobs/${j.id}`,
        snippet: stripHtml(j.description).slice(0, 500),
        publishedAt: j.date ? new Date(j.date * 1000) : undefined,
        raw: j,
      }));
  },
};
