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
    const url = `https://www.wantedly.com/api/v1/projects?query=${encodeURIComponent(keyword)}`;
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "application/json" },
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) throw new Error(`wantedly HTTP ${res.status}`);
    const body = (await res.json()) as { data?: WtProject[] };

    const list = body.data ?? [];
    return list.slice(0, 20).map((p) => ({
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
