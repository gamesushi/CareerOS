import type { JobSource, SourceJob } from "./types";
import { scrapeIndeed, type IndeedScrapeOpts } from "./indeed";

// Indeed 国际站（www.indeed.com，美国/全球）。与日本站共用 headless 抓取逻辑，
// 仅 host/locale/externalId 前缀不同（jk 可能跨站撞车，故前缀区分）。
// 支持翻页 + 多关键词展开（searchMany），显著扩大单次监测覆盖。

const GLOBAL_OPTS: IndeedScrapeOpts = {
  host: "www.indeed.com",
  locale: "en-US",
  label: "global",
  prefix: "indeed-global",
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const indeedGlobalSource: JobSource = {
  id: "indeed-global",
  label: "Indeed 国际",
  async search(keyword: string) {
    return scrapeIndeed(GLOBAL_OPTS, keyword);
  },
  async searchMany(keywords: string[]): Promise<SourceJob[]> {
    const merged = new Map<string, SourceJob>();
    for (const kw of keywords) {
      const jobs = await scrapeIndeed(GLOBAL_OPTS, kw);
      for (const j of jobs) merged.set(j.externalId, j);
      await sleep(1500);
    }
    return [...merged.values()];
  },
};
