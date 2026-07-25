import { z } from "zod";

// 岗位监测契约。来源清单与 worker 的适配器注册表保持一致（新增来源需同步这里）。

// 品类：用于用户端「品类匹配」可选开关。新增品类见 sources/lib/category.ts。
export const JOB_CATEGORIES = [
  { id: "game", label: "游戏类" },
  { id: "finance", label: "金融类" },
  { id: "tech", label: "技术类" },
] as const;

export const WATCH_SOURCES = [
  { id: "tencent", label: "腾讯招聘", category: "tech" },
  { id: "bytedance", label: "字节跳动招聘", category: "tech" },
  { id: "liepin", label: "猎聘" },
  { id: "boss", label: "BOSS直聘" },
  { id: "green", label: "Green" },
  { id: "indeed", label: "Indeed" },
  { id: "wantedly", label: "Wantedly" },
  { id: "remoteok", label: "RemoteOK" },
  { id: "hackernews", label: "Hacker News" },
  { id: "netease", label: "网易游戏", category: "game" },
  { id: "mihoyo", label: "米哈游", category: "game" },
  // 游戏公司（Greenhouse 官方招聘板）
  { id: "riotgames", label: "Riot Games", category: "game" },
  { id: "scopely", label: "Scopely", category: "game" },
  { id: "krafton", label: "Krafton", category: "game" },
  { id: "nintendo", label: "Nintendo", category: "game" },
  { id: "epicgames", label: "Epic Games", category: "game" },
  { id: "taketwo", label: "Take-Two Interactive", category: "game" },
  { id: "nordeus", label: "Nordeus", category: "game" },
  { id: "bungie", label: "Bungie", category: "game" },
  { id: "wooga", label: "Wooga", category: "game" },
  { id: "remedy", label: "Remedy Entertainment", category: "game" },
  { id: "bethesda", label: "Bethesda", category: "game" },
  { id: "housemarque", label: "Housemarque", category: "game" },
  // 金融：银行 / 数字银行 / 借贷
  { id: "sofi", label: "SoFi", category: "finance" },
  { id: "brex", label: "Brex", category: "finance" },
  { id: "chime", label: "Chime", category: "finance" },
  { id: "monzo", label: "Monzo", category: "finance" },
  { id: "n26", label: "N26", category: "finance" },
  { id: "upgrade", label: "Upgrade", category: "finance" },
  { id: "affirm", label: "Affirm", category: "finance" },
  { id: "mercury", label: "Mercury", category: "finance" },
  { id: "coinbase", label: "Coinbase", category: "finance" },
  // 金融：保险
  { id: "oscar", label: "Oscar Health", category: "finance" },
  { id: "ethos", label: "Ethos", category: "finance" },
  // 金融：基金 / 资管 / 量化交易
  { id: "point72", label: "Point72", category: "finance" },
  { id: "imc", label: "IMC", category: "finance" },
  { id: "winton", label: "Winton", category: "finance" },
  { id: "janestreet", label: "Jane Street", category: "finance" },
  { id: "mangroup", label: "Man Group", category: "finance" },
  { id: "jumptrading", label: "Jump Trading", category: "finance" },
  { id: "flowtraders", label: "Flow Traders", category: "finance" },
  { id: "tide", label: "Tide", category: "finance" },
  { id: "adyen", label: "Adyen", category: "finance" },
  { id: "payoneer", label: "Payoneer", category: "finance" },
  { id: "robinhood", label: "Robinhood", category: "finance" },
  { id: "schonfeld", label: "Schonfeld", category: "finance" },
  { id: "exoduspoint", label: "ExodusPoint", category: "finance" },
  // 金融：中文官网（best-effort，需 headless 浏览器）
  { id: "pingan", label: "中国平安", category: "finance" },
  { id: "efund", label: "易方达基金", category: "finance" },
  { id: "cmb", label: "招商银行", category: "finance" },
] as const;

export const watchSourceIds = WATCH_SOURCES.map((s) => s.id) as [string, ...string[]];

export const jobWatchInput = z.object({
  name: z.string().min(1).max(120),
  keywords: z.array(z.string().min(1).max(60)).min(1).max(5),
  sources: z.array(z.enum(watchSourceIds)).min(1),
  locations: z.array(z.string().max(40)).max(5).default([]),
  // 品类匹配：非空时只保留命中这些品类的岗位（见 sources/lib/category.ts）
  matchCategories: z.array(z.enum(["game", "finance", "tech"])).max(3).default([]),
  intervalMinutes: z.number().int().min(30).max(24 * 60).default(60),
  enabled: z.boolean().default(true),
});

export type JobWatchInput = z.infer<typeof jobWatchInput>;

export const discoveredJobStatusInput = z.object({
  status: z.enum(["viewed", "dismissed"]),
});
