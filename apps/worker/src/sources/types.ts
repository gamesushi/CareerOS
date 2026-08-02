// 岗位来源适配器接口：新增站点 = 实现 JobSource + 在 index.ts 注册一行。
// 约定：只调用公开的岗位搜索接口、只取第一页、低频轮询（默认 60 分钟），
// 单次请求间 sleep 400ms，礼貌抓取。

import type { JobCategory } from "./lib/category";

export type SourceJob = {
  externalId: string;
  title: string;
  company?: string;
  location?: string;
  salary?: string;
  url: string;
  snippet?: string;
  publishedAt?: Date;
  /** 品类标签（由适配器用分类器 + 来源亲和生成），用于用户端品类匹配 */
  categories?: JobCategory[];
  raw?: unknown;
};

export interface JobSource {
  id: string;
  label: string;
  /** 该来源的品类亲和（如游戏厂默认 "game"），用于来源级品类匹配 */
  category?: JobCategory;
  /** 整板抓取型适配器：一次性返回该来源全部在招岗位（忽略关键词）。
   *  实现此方法的来源在一次轮询内按 sourceId 缓存，避免同一板块被多关键词重复抓取。
   *  未实现时，watchPoll 退化为逐关键词调用 search(keyword)。 */
  fetchAll?(): Promise<SourceJob[]>;
  /** 搜一个关键词，返回第一页结果（适配器内部自行处理分页大小）。
   *  仅用于未实现 fetchAll 的来源（如按关键词真查询的站点）。 */
  search(keyword: string): Promise<SourceJob[]>;
}

export const politeDelay = () => new Promise((r) => setTimeout(r, 400));

export const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";
