import type { JobSource, SourceJob } from "./types";
import { UA } from "./types";

// 字节跳动招聘（jobs.bytedance.com）社招门户搜索接口。
// POST /api/v1/search/job/posts；需要 portal 头与 csrf cookie（先 GET 首页取 cookie）。
// 响应：{ code: 0, data: { job_post_list: [{ id, title, city_info:{name}, description,
//   publish_time, recruit_type... }] } }

type ByteDancePost = {
  id: string;
  title: string;
  city_info?: { name?: string };
  description?: string;
  publish_time?: number;
};

let cookieCache: { value: string; at: number } | null = null;

async function getCookies(): Promise<string> {
  if (cookieCache && Date.now() - cookieCache.at < 30 * 60 * 1000) return cookieCache.value;
  const res = await fetch("https://jobs.bytedance.com/experienced/", {
    headers: { "User-Agent": UA },
    signal: AbortSignal.timeout(20_000),
    redirect: "follow",
  });
  const cookies = res.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ");
  cookieCache = { value: cookies, at: Date.now() };
  return cookies;
}

export const bytedanceSource: JobSource = {
  id: "bytedance",
  label: "字节跳动招聘",
  async search(keyword: string): Promise<SourceJob[]> {
    const cookies = await getCookies();
    const csrf = cookies.match(/atsx-csrf-token=([^;]+)/)?.[1];

    const all: ByteDancePost[] = [];
    const seen = new Set<string>();
    const PAGE = 50;
    // 字节在招量极大（>=2500），放宽到 100 页（5000 上限）以更接近全量；
    // 去重保护已确保即使接口忽略 offset 也不会 OOM。
    const MAX_PAGES = 100;
    // 字节接口支持 offset 翻页；循环到不足一页即停。
    // 防御：按 externalId 去重，若某页无新增则立即停止——
    // 部分站点会忽略 offset 每页返回完整结果集，无此保护会无限累积导致 OOM。
    for (let page = 0; page < MAX_PAGES; page++) {
      const offset = page * PAGE;
      const res = await fetch(
        "https://jobs.bytedance.com/api/v1/search/job/posts?keyword=" +
          encodeURIComponent(keyword) +
          `&limit=${PAGE}&offset=${offset}`,
        {
          method: "POST",
          headers: {
            "User-Agent": UA,
            "Content-Type": "application/json",
            Referer: "https://jobs.bytedance.com/experienced/position",
            "Portal-Channel": "office",
            "Portal-Platform": "pc",
            ...(cookies ? { Cookie: cookies } : {}),
            ...(csrf ? { "X-CSRF-Token": decodeURIComponent(csrf) } : {}),
          },
          body: JSON.stringify({
            keyword,
            limit: PAGE,
            offset,
            job_category_id_list: [],
            tag_id_list: [],
            location_code_list: [],
            subject_id_list: [],
            recruitment_id_list: [],
            portal_type: 2, // 社招
            job_function_id_list: [],
          }),
          signal: AbortSignal.timeout(20_000),
        },
      );
      if (!res.ok) throw new Error(`bytedance HTTP ${res.status}`);
      const body = (await res.json()) as { code: number; data?: { job_post_list?: ByteDancePost[] } };
      if (body.code !== 0) throw new Error(`bytedance API code ${body.code}`);
      const list = body.data?.job_post_list ?? [];
      let added = 0;
      for (const p of list) {
        if (seen.has(p.id)) continue;
        seen.add(p.id);
        all.push(p);
        added++;
      }
      if (list.length < PAGE || added === 0) break;
    }

    return all.map((p) => ({
      externalId: p.id,
      title: p.title,
      company: "字节跳动",
      location: p.city_info?.name,
      url: `https://jobs.bytedance.com/experienced/position/${p.id}/detail`,
      snippet: p.description?.slice(0, 500),
      publishedAt: p.publish_time ? new Date(p.publish_time) : undefined,
      raw: p,
    }));
  },
};
