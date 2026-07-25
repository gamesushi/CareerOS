import type { JobSource, SourceJob } from "./types";
import { UA } from "./types";
import { fetchJson, stripHtml } from "./lib/scraper";
import { deriveCategories, type JobCategory } from "./lib/category";

// Greenhouse 招聘板适配器工厂（可复用）。
// Greenhouse（greenhouse.io）是大量公司（含网易游戏、Stripe、Coinbase 等）使用的 ATS，
// 提供公开 JSON 接口：GET /v1/boards/<board>/jobs?content=false
// 返回 { jobs:[{ id, title, company, location:{name}, absolute_url, updated_at, content }] }。
// 任何使用 Greenhouse 的公司，只要知道其 board token，一行即可接入。

export type GreenhouseOptions = {
  id: string;
  label: string;
  /** Greenhouse board token，例如网易游戏为 "neteasegames" */
  board: string;
  /** 该来源的品类亲和（如游戏厂默认 "game"） */
  category?: JobCategory;
};

type GhJob = {
  id: number | string;
  title?: string;
  company?: string;
  location?: { name?: string } | string;
  absolute_url?: string;
  url?: string;
  content?: string;
  updated_at?: string;
};

export function makeGreenhouseSource(opts: GreenhouseOptions): JobSource {
  return {
    id: opts.id,
    label: opts.label,
    category: opts.category,
    async search(keyword: string): Promise<SourceJob[]> {
      const url = `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(
        opts.board,
      )}/jobs?content=false`;
      const data = await fetchJson<{ jobs?: GhJob[] }>(url);
      const all = data.jobs ?? [];
      const kw = keyword.trim().toLowerCase();
      // Greenhouse 公共接口不支持按关键词服务端过滤，客户端按标题包含过滤
      const matched = kw ? all.filter((j) => (j.title ?? "").toLowerCase().includes(kw)) : all;

      return matched.slice(0, 20).map((j) => {
        const loc = typeof j.location === "string" ? j.location : j.location?.name;
        const text = `${j.title ?? ""} ${j.company ?? ""} ${loc ?? ""}`;
        return {
          externalId: `${opts.id}-${j.id}`,
          title: j.title ?? "(untitled)",
          company: j.company ?? opts.label,
          location: loc,
          url:
            j.absolute_url ??
            j.url ??
            `https://boards-api.greenhouse.io/v1/boards/${opts.board}/jobs/${j.id}`,
          snippet: stripHtml(j.content).slice(0, 500),
          publishedAt: j.updated_at ? new Date(j.updated_at) : undefined,
          categories: deriveCategories(text, opts.category),
          raw: j,
        };
      });
    },
  };
}

// 网易游戏（Greenhouse board: neteasegames），默认游戏类。
export const neteaseSource = makeGreenhouseSource({
  id: "netease",
  label: "网易游戏",
  board: "neteasegames",
  category: "game",
});

// 更多游戏公司（均为 Greenhouse 官方招聘板，已实网验证 2026-07-25 返回真实岗位）。
// 任何使用 Greenhouse 的游戏厂，只要知道 board token，一行即可接入。
export const riotgamesSource = makeGreenhouseSource({
  id: "riotgames", label: "Riot Games", board: "riotgames", category: "game",
});
export const scopelySource = makeGreenhouseSource({
  id: "scopely", label: "Scopely", board: "scopely", category: "game",
});
export const kraftonSource = makeGreenhouseSource({
  id: "krafton", label: "Krafton", board: "krafton", category: "game",
});
export const nintendoSource = makeGreenhouseSource({
  id: "nintendo", label: "Nintendo", board: "nintendo", category: "game",
});
export const epicgamesSource = makeGreenhouseSource({
  id: "epicgames", label: "Epic Games", board: "epicgames", category: "game",
});
