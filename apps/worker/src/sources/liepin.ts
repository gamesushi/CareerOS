import type { JobSource, SourceJob } from "./types";
import { UA } from "./types";

// 猎聘（liepin.com）搜索结果页（服务端渲染 HTML）。
// 注意：猎聘反爬强，裸请求常被拦（实测返回 400 + "Robot"）。先取首页 cookie 再请求，
// 仍为 best-effort；真实可用需补充合规的 Cookie/签名或走其开放接口。命中失败返回空数组。

export const liepinSource: JobSource = {
  id: "liepin",
  label: "猎聘",
  async search(keyword: string): Promise<SourceJob[]> {
    // 1) 取首页 cookie（尽力）
    let cookie = "";
    try {
      const home = await fetch("https://www.liepin.com/", {
        headers: { "User-Agent": UA },
        signal: AbortSignal.timeout(15_000),
      });
      cookie = home.headers
        .getSetCookie?.()
        .map((c) => c.split(";")[0])
        .join("; ") ?? "";
    } catch {
      // 取 cookie 失败不致命
    }

    // 2) 请求搜索页
    const url = `https://www.liepin.com/zhaopin/?key=${encodeURIComponent(keyword)}`;
    const res = await fetch(url, {
      headers: {
        "User-Agent": UA,
        Accept: "text/html,application/xhtml+xml",
        ...(cookie ? { Cookie: cookie } : {}),
      },
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) throw new Error(`liepin HTTP ${res.status}`);
    const html = await res.text();

    const jobs: SourceJob[] = [];
    // 职位卡片：data-job-id 标记 + 邻近的职位标题链接
    const cardRe = /data-job-id="(\d+)"[\s\S]*?href="([^"]*?\/job\/[^"]+)"[\s\S]*?>(.*?)<\/a>/g;
    const clean = (s: string) => s.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
    let m: RegExpExecArray | null;
    while ((m = cardRe.exec(html)) !== null && jobs.length < 20) {
      const id = m[1];
      const href = m[2];
      const title = clean(m[3]);
      if (!title) continue;
      jobs.push({
        externalId: `liepin-${id}`,
        title,
        url: href.startsWith("http") ? href : `https://www.liepin.com${href}`,
        raw: { id, href },
      });
    }
    return jobs;
  },
};
