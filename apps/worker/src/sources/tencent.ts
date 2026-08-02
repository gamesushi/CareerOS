import type { JobSource, SourceJob } from "./types";
import { UA } from "./types";

// 腾讯招聘（careers.tencent.com）公开搜索接口。
// 响应结构：{ Code: 200, Data: { Count, Posts: [{ PostId, RecruitPostName, CountryName,
//   LocationName, CategoryName, Responsibility, LastUpdateTime, PostURL }] } }

type TencentPost = {
  PostId: string;
  RecruitPostName: string;
  CountryName?: string;
  LocationName?: string;
  CategoryName?: string;
  Responsibility?: string;
  LastUpdateTime?: string;
  PostURL?: string;
};

function parseTime(s?: string): Date | undefined {
  if (!s) return undefined;
  // 已知格式如 "2026年07月17日" 或 ISO；都尝试
  const cn = s.match(/(\d{4})年(\d{2})月(\d{2})日/);
  if (cn) return new Date(`${cn[1]}-${cn[2]}-${cn[3]}T00:00:00+08:00`);
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

export const tencentSource: JobSource = {
  id: "tencent",
  label: "腾讯招聘",
  async search(keyword: string): Promise<SourceJob[]> {
    const all: TencentPost[] = [];
    const seen = new Set<string>();
    const PAGE = 50;
    // 腾讯接口支持 pageIndex 翻页；循环到不足一页即停。
    // 防御：按 PostId 去重，若某页无新增则停（防接口忽略分页参数导致无限累积）。
    for (let pageIndex = 1; pageIndex <= 50; pageIndex++) {
      const url = new URL("https://careers.tencent.com/tencentcareer/api/post/Query");
      url.searchParams.set("timestamp", String(Date.now()));
      url.searchParams.set("keyword", keyword);
      url.searchParams.set("pageIndex", String(pageIndex));
      url.searchParams.set("pageSize", String(PAGE));
      url.searchParams.set("language", "zh-cn");

      const res = await fetch(url, {
        headers: { "User-Agent": UA, Referer: "https://careers.tencent.com/" },
        signal: AbortSignal.timeout(20_000),
      });
      if (!res.ok) throw new Error(`tencent HTTP ${res.status}`);
      const body = (await res.json()) as { Code: number; Data?: { Posts?: TencentPost[] } };
      if (body.Code !== 200) throw new Error(`tencent API Code ${body.Code}`);
      const posts = body.Data?.Posts ?? [];
      let added = 0;
      for (const p of posts) {
        if (seen.has(p.PostId)) continue;
        seen.add(p.PostId);
        all.push(p);
        added++;
      }
      if (posts.length < PAGE || added === 0) break;
    }

    return all.map((p) => ({
      externalId: p.PostId,
      title: p.RecruitPostName,
      company: "腾讯",
      location: [p.CountryName, p.LocationName].filter(Boolean).join(" · ") || undefined,
      url: p.PostURL || `https://careers.tencent.com/jobdesc.html?postId=${p.PostId}`,
      snippet: p.Responsibility?.slice(0, 500),
      publishedAt: parseTime(p.LastUpdateTime),
      raw: p,
    }));
  },
};
