import type { JobSource, SourceJob } from "./types";
import { UA } from "./types";
import { fetchJson, stripHtml } from "./lib/scraper";
import { deriveCategories, type JobCategory } from "./lib/category";

// Ashby 招聘板适配器工厂（可复用）。
// Ashby（ashbyhq.com）是大量 AI / 初创公司使用的 ATS，提供公开 JSON 接口：
//   GET https://api.ashbyhq.com/posting-api/job-board/<organizationId>
// 返回 { jobs:[{ id, title, team, location, employmentType, jobUrl, publishedAt, descriptionHtml }] }。
// 任何使用 Ashby 的公司，只要知道其 org subdomain，一行即可接入。
// 与 Greenhouse 不同：location 是字符串（非 {name}），且有 publishedAt 字段。

export type AshbyOptions = {
  id: string;
  label: string;
  /** Ashby 组织 subdomain，例如 OpenAI 为 "openai" */
  org: string;
  /** 该来源的品类亲和（如 AI 公司默认 "ai"） */
  category?: JobCategory;
};

type AshbyJob = {
  id: string;
  title?: string;
  team?: string;
  location?: string | { name?: string };
  employmentType?: string;
  jobUrl?: string;
  publishedAt?: string;
  isListed?: boolean;
  descriptionHtml?: string;
  descriptionPlain?: string;
};

export function makeAshbySource(opts: AshbyOptions): JobSource {
  // 整板抓取：Ashby 公开接口一次性返回该组织全部在招岗位（无服务端分页/关键词过滤）。
  // 2000 仅作安全上限（任何公司的真实在招数都远小于此），实现"抓取全量"。
  const fetchAll = async (): Promise<SourceJob[]> => {
    const url = `https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(opts.org)}`;
    const data = await fetchJson<{ jobs?: AshbyJob[] }>(url);
    const all = (data.jobs ?? []).filter((j) => j.isListed !== false);
    const LIMIT = 2000;
    return all.slice(0, LIMIT).map((j) => {
      const loc = typeof j.location === "string" ? j.location : j.location?.name;
      const text = `${j.title ?? ""} ${j.team ?? ""} ${loc ?? ""}`;
      return {
        externalId: `${opts.id}-${j.id}`,
        title: j.title ?? "(untitled)",
        company: opts.label,
        location: loc,
        url:
          j.jobUrl ??
          `https://api.ashbyhq.com/posting-api/job-board/${opts.org}/${j.id}`,
        snippet: stripHtml(j.descriptionHtml ?? j.descriptionPlain ?? "").slice(0, 500),
        publishedAt: j.publishedAt ? new Date(j.publishedAt) : undefined,
        categories: deriveCategories(text, opts.category),
        raw: j,
      };
    });
  };

  return {
    id: opts.id,
    label: opts.label,
    category: opts.category,
    fetchAll,
    async search(keyword: string): Promise<SourceJob[]> {
      const all = await fetchAll();
      const kw = keyword.trim().toLowerCase();
      // Ashby 公共接口不支持按关键词服务端过滤，客户端按标题包含过滤
      return kw ? all.filter((j) => (j.title ?? "").toLowerCase().includes(kw)) : all;
    },
  };
}
