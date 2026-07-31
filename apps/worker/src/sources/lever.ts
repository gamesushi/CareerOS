import type { JobSource, SourceJob } from "./types";
import { fetchJson, stripHtml } from "./lib/scraper";
import { deriveCategories, type JobCategory } from "./lib/category";

// Lever 招聘板适配器工厂（可复用）。
// Lever（lever.co）是美国另一主流 ATS，提供公开 JSON 接口（无需鉴权、无反爬）：
//   GET https://api.lever.co/v0/postings/<company>?mode=json
// 返回岗位对象数组，默认包含该司全部开放岗位（不像 Greenhouse 只给首页 20 条）。
// 字段与 Greenhouse 不同：标题在 text、链接在 hostedUrl/applyUrl、时间为 createdAt(unix ms)、
// 地点在 categories.location 数组。任何使用 Lever 的公司，只要知道 company token，一行即可接入。
// 注：实测大量知名公司（OpenAI/Netflix/Anthropic/NVIDIA 等）的 Lever token 为 404，
// 它们多用 Workday/SmartRecruiters/自建 ATS，并非 Lever。

export type LeverOptions = {
  id: string;
  label: string;
  /** Lever company token，例如 Spotify 为 "spotify" */
  company: string;
  /** 该来源的品类亲和 */
  category?: JobCategory;
};

type LeverPosting = {
  id: string;
  text?: string;
  categories?: {
    commitment?: string[] | string;
    location?: string[] | string;
    team?: string[] | string;
    department?: string[] | string;
    [k: string]: string[] | string | undefined;
  };
  hostedUrl?: string;
  applyUrl?: string;
  createdAt?: number;
  descriptionPlain?: string;
  country?: string;
  company?: string;
};

/** Lever 不同 board 的 categories 字段可能是 string 也可能是 string[]，统一成数组。 */
function toArr(x: string[] | string | undefined): string[] {
  if (x == null) return [];
  return Array.isArray(x) ? x : [x];
}

export function makeLeverSource(opts: LeverOptions): JobSource {
  return {
    id: opts.id,
    label: opts.label,
    category: opts.category,
    async search(keyword: string): Promise<SourceJob[]> {
      const url = `https://api.lever.co/v0/postings/${encodeURIComponent(opts.company)}?mode=json`;
      const data = await fetchJson<LeverPosting[]>(url);
      const all: LeverPosting[] = Array.isArray(data) ? data : [];
      const kw = keyword.trim().toLowerCase();
      const matched = kw ? all.filter((j) => (j.text ?? "").toLowerCase().includes(kw)) : all;

      return matched.slice(0, 20).map((j) => {
        const locParts = toArr(j.categories?.location);
        const teamParts = toArr(j.categories?.team);
        const loc = locParts.length
          ? locParts.join(", ")
          : typeof j.country === "string"
            ? j.country
            : undefined;
        const title = j.text ?? "(untitled)";
        const text = `${title} ${loc ?? ""} ${teamParts.join(" ")}`;
        return {
          externalId: `${opts.id}-${j.id}`,
          title,
          company: j.company ?? opts.label,
          location: loc,
          url:
            j.hostedUrl ??
            j.applyUrl ??
            `https://jobs.lever.co/${opts.company}/${j.id}`,
          snippet: stripHtml(j.descriptionPlain).slice(0, 500),
          publishedAt: j.createdAt ? new Date(j.createdAt) : undefined,
          categories: deriveCategories(text, opts.category),
          raw: j,
        };
      });
    },
  };
}

// Spotify（Lever board=spotify，实网验证 2026-07-27 返回 73 个真实岗位）。媒体/内容。
// 注：媒体/设计/加密没有对应 JobCategory（窄集合 game/finance/tech/ai/general），
// 故 category 亲和省略，由文本分类器按岗位标题推断（技术岗→tech，其余→general）。
export const spotifySource = makeLeverSource({
  id: "spotify",
  label: "Spotify",
  company: "spotify",
});

// 以下 4 个源：2026-07-28 Lever token 扩探实网验证，均返回真实岗位（公开 JSON，无鉴权）。
// 大厂多走 Greenhouse/Workday，Lever 命中率本就低，这 4 个是本轮唯一可用的新增。

// Binance（加密货币交易所，Lever board=binance，验证 289 岗，全球分布）。金融/交易亲和。
export const binanceSource = makeLeverSource({
  id: "binance",
  label: "Binance",
  company: "binance",
  category: "finance",
});

// AngelList / Wellfound（创业投资/融资平台，Lever board=angellist，验证 22 岗）。金融亲和。
export const angellistSource = makeLeverSource({
  id: "angellist",
  label: "AngelList",
  company: "angellist",
  category: "finance",
});

// The Athletic（体育订阅媒体，Lever board=theathletic，验证 15 岗）。媒体无 JobCategory，省略亲和。
export const theAthleticSource = makeLeverSource({
  id: "theathletic",
  label: "The Athletic",
  company: "theathletic",
});

// Houzz（家居/室内设计电商市场，Lever board=houzz，验证 6 岗）。设计无 JobCategory，省略亲和。
export const houzzSource = makeLeverSource({
  id: "houzz",
  label: "Houzz",
  company: "houzz",
});
