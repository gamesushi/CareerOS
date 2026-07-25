import type { JobSource, SourceJob } from "./types";
import { UA } from "./types";

// Indeed（jp.indeed.com）— 日本站。搜索结果页（HTML，Cloudflare 强反爬）。
// 裸请求可能被拦截返回挑战页，需配合合规的反爬/代理策略。此处尽力实现，
// 解析失败返回空数组。如需全球站，可把 host 改为 www.indeed.com。

export const indeedSource: JobSource = {
  id: "indeed",
  label: "Indeed",
  async search(keyword: string): Promise<SourceJob[]> {
    const url = `https://jp.indeed.com/jobs?q=${encodeURIComponent(keyword)}&l=`;
    const res = await fetch(url, {
      headers: {
        "User-Agent": UA,
        Accept: "text/html",
        "Accept-Language": "ja-JP,ja;q=0.9",
      },
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) throw new Error(`indeed HTTP ${res.status}`);
    const html = await res.text();

    const jobs: SourceJob[] = [];
    // 职位卡片：data-jk 标记；标题在 <h2><a href="/rc/..."> 内
    const cardRe = /data-jk="([A-Za-z0-9/_+=]+)"[\s\S]*?<h2[^>]*>[\s\S]*?href="(\/rc\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
    const clean = (s: string) => s.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
    let m: RegExpExecArray | null;
    while ((m = cardRe.exec(html)) !== null && jobs.length < 20) {
      const jk = m[1];
      const href = m[2];
      const title = clean(m[3]);
      if (!title) continue;
      jobs.push({
        externalId: `indeed-${jk}`,
        title,
        url: href.startsWith("http") ? href : `https://jp.indeed.com${href}`,
        raw: { jk },
      });
    }
    return jobs;
  },
};
