import type { JobSource, SourceJob } from "./types";
import { UA } from "./types";

// Wantedly（wantedly.com）— 日本主流求职/兼职平台，偏项目制（projects）。
// 公开搜索端点 GET /api/v1/projects?query=<kw> 返回 { data: [...] }，字段已验证。

type WtProject = {
  id?: string | number;
  title?: string;
  company?: { name?: string };
  location?: string;
  description?: string;
  published_at?: string;
};

export const wantedlySource: JobSource = {
  id: "wantedly",
  label: "Wantedly",
  async search(keyword: string): Promise<SourceJob[]> {
    const all: WtProject[] = [];
    const seen = new Set<string | number | undefined>();
    // Wantedly projects 接口支持 &page=N 翻页；循环到空页或不足一页即停（最多 20 页安全上限）。
    // 按项目 id 去重，防接口忽略分页参数导致重复累积。
    for (let page = 1; page <= 20; page++) {
      const url = `https://www.wantedly.com/api/v1/projects?query=${encodeURIComponent(keyword)}&page=${page}`;
      const res = await fetch(url, {
        headers: { "User-Agent": UA, Accept: "application/json" },
        signal: AbortSignal.timeout(20_000),
      });
      if (!res.ok) throw new Error(`wantedly HTTP ${res.status}`);
      const body = (await res.json()) as { data?: WtProject[] };
      const list = body.data ?? [];
      if (list.length === 0) break;
      let added = 0;
      for (const p of list) {
        if (seen.has(p.id)) continue;
        seen.add(p.id);
        all.push(p);
        added++;
      }
      if (list.length < 20 || added === 0) break;
    }
    return all.map((p) => ({
      externalId: `wantedly-${p.id ?? crypto.randomUUID()}`,
      title: p.title ?? "(untitled)",
      company: p.company?.name,
      location: p.location,
      url: `https://www.wantedly.com/projects/${p.id}`,
      snippet: p.description?.slice(0, 500),
      publishedAt: p.published_at ? new Date(p.published_at) : undefined,
      raw: p,
    }));
  },
};
