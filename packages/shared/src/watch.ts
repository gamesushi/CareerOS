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
