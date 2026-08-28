import type { JobSource } from "./types";
import { scrapeIndeed } from "./indeed";

// Indeed 国际站（www.indeed.com，美国/全球）。与日本站共用 headless 抓取逻辑，
// 仅 host/locale/externalId 前缀不同（jk 可能跨站撞车，故前缀区分）。

export const indeedGlobalSource: JobSource = {
  id: "indeed-global",
  label: "Indeed 国际",
  async search(keyword: string) {
    return scrapeIndeed(
      {
        host: "www.indeed.com",
        locale: "en-US",
        label: "global",
        prefix: "indeed-global",
      },
      keyword,
    );
  },
};
