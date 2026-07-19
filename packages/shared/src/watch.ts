import { z } from "zod";

// 岗位监测契约。来源清单与 worker 的适配器注册表保持一致（新增来源需同步这里）。

export const WATCH_SOURCES = [
  { id: "tencent", label: "腾讯招聘" },
  { id: "bytedance", label: "字节跳动招聘" },
] as const;

export const watchSourceIds = WATCH_SOURCES.map((s) => s.id) as [string, ...string[]];

export const jobWatchInput = z.object({
  name: z.string().min(1).max(120),
  keywords: z.array(z.string().min(1).max(60)).min(1).max(5),
  sources: z.array(z.enum(watchSourceIds)).min(1),
  locations: z.array(z.string().max(40)).max(5).default([]),
  intervalMinutes: z.number().int().min(30).max(24 * 60).default(60),
  enabled: z.boolean().default(true),
});

export type JobWatchInput = z.infer<typeof jobWatchInput>;

export const discoveredJobStatusInput = z.object({
  status: z.enum(["viewed", "dismissed"]),
});
