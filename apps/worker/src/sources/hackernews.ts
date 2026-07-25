import type { JobSource, SourceJob } from "./types";
import { UA } from "./types";

// Hacker News「Who is hiring?」每月招募帖（由 whoishiring 账号发布）。
// 用 Algolia 公开 API：先定位最新一期帖，再在该帖评论里检索关键词。
// 完全无反爬，是"全球/初创/远程"来源的可靠补充。

type HnHit = {
  objectID?: string;
  comment_text?: string;
  author?: string;
  created_at?: string;
};

const stripHtml = (s?: string) =>
  (s ?? "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

const firstLine = (s: string) => {
  const line = s
    .split(/\n/)
    .map((l) => l.trim())
    .find((l) => l.length > 0);
  return line ? line.slice(0, 160) : "(HN post)";
};

export const hackernewsSource: JobSource = {
  id: "hackernews",
  label: "Hacker News",
  async search(keyword: string): Promise<SourceJob[]> {
    // 1) 定位最新一期「Who is hiring」
    const threadRes = await fetch(
      "https://hn.algolia.com/api/v1/search_by_date?query=who%20is%20hiring&tags=story,author_whoishiring&hitsPerPage=1",
      { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(20_000) },
    );
    if (!threadRes.ok) throw new Error(`hn thread HTTP ${threadRes.status}`);
    const thread = (await threadRes.json()) as { hits?: HnHit[] };
    const threadId = thread.hits?.[0]?.objectID;
    if (!threadId) return [];

    // 2) 在该帖评论中检索关键词
    const q = encodeURIComponent(keyword);
    const cRes = await fetch(
      `https://hn.algolia.com/api/v1/search?query=${q}&tags=comment,story_${threadId}`,
      { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(20_000) },
    );
    if (!cRes.ok) throw new Error(`hn comments HTTP ${cRes.status}`);
    const body = (await cRes.json()) as { hits?: HnHit[] };
    const hits = body.hits ?? [];

    return hits.slice(0, 20).map((c) => {
      const text = stripHtml(c.comment_text);
      return {
        externalId: `hn-${c.objectID}`,
        title: firstLine(text),
        url: `https://news.ycombinator.com/item?id=${c.objectID}`,
        snippet: text.slice(0, 500),
        publishedAt: c.created_at ? new Date(c.created_at) : undefined,
        raw: c,
      };
    });
  },
};
