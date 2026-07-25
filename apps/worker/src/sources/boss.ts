import type { JobSource, SourceJob } from "./types";
import { UA } from "./types";

// BOSS 直聘（zhipin.com）搜索结果页。
// 注意：BOSS 反爬极强，列表接口需要签名 cookie（__zp_stoken_ 等），裸请求大概率被拦。
// 此处先取首页 cookie 再请求搜索页，做防御式解析；真实可用需补充签名/反爬处理，
// 并在合规前提下使用。解析失败返回空数组。

export const bossSource: JobSource = {
  id: "boss",
  label: "BOSS直聘",
  async search(keyword: string): Promise<SourceJob[]> {
    // 1) 取首页 cookie
    let cookie = "";
    try {
      const home = await fetch("https://www.zhipin.com/", {
        headers: { "User-Agent": UA },
        signal: AbortSignal.timeout(15_000),
      });
      cookie = home.headers
        .getSetCookie?.()
        .map((c) => c.split(";")[0])
        .join("; ") ?? "";
    } catch {
      // 取 cookie 失败不致命，继续尝试
    }

    // 2) 请求搜索页
    const url = `https://www.zhipin.com/web/geek/job?query=${encodeURIComponent(keyword)}`;
    const res = await fetch(url, {
      headers: { "User-Agent": UA, ...(cookie ? { Cookie: cookie } : {}) },
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) throw new Error(`boss HTTP ${res.status}`);
    const html = await res.text();

    const jobs: SourceJob[] = [];
    const cardRe = /data-jobid="([^"]+)"[\s\S]*?href="([^"]*?\/job_detail\/[^"]+)"[\s\S]*?class="job-name"[^>]*>([\s\S]*?)<\/a>/g;
    const clean = (s: string) => s.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
    let m: RegExpExecArray | null;
    while ((m = cardRe.exec(html)) !== null && jobs.length < 20) {
      const id = m[1];
      const href = m[2];
      const title = clean(m[3]);
      if (!title) continue;
      jobs.push({
        externalId: `boss-${id}`,
        title,
        url: href.startsWith("http") ? href : `https://www.zhipin.com${href}`,
        raw: { id, href },
      });
    }
    return jobs;
  },
};
