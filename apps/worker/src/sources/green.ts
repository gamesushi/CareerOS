import type { JobSource, SourceJob } from "./types";
import { UA } from "./types";

// Green（www.green-japan.com）— 日本 IT/引擎职种招聘站（Next.js，MUI class）。
// 搜索结果页 HTML。岗位链接形如 /company/<id>/job/<id>，标题在
// <h2 class="...job-offer-name"> 内。注：偏日文，关键词建议用日文。

export const greenSource: JobSource = {
  id: "green",
  label: "Green",
  async search(keyword: string): Promise<SourceJob[]> {
    const url = `https://www.green-japan.com/search?keyword=${encodeURIComponent(keyword)}`;
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "text/html" },
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) throw new Error(`green HTTP ${res.status}`);
    const html = await res.text();

    const jobs: SourceJob[] = [];
    const cardRe =
      /href="(\/company\/\d+\/job\/\d+)"[^>]*>[\s\S]*?<h2[^>]*job-offer-name[^>]*>(.*?)<\/h2>/g;
    const clean = (s: string) => s.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
    let m: RegExpExecArray | null;
    while ((m = cardRe.exec(html)) !== null && jobs.length < 20) {
      const href = m[1];
      const title = clean(m[2]);
      if (!title) continue;
      const jobId = href.match(/\/job\/(\d+)/)?.[1] ?? href;
      jobs.push({
        externalId: `green-${jobId}`,
        title,
        url: `https://www.green-japan.com${href}`,
        raw: { href },
      });
    }
    return jobs;
  },
};
