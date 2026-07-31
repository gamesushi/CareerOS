// 用户录入岗位（手动表单 / URL 导入）的公共逻辑。
//
// 设计：DiscoveredJob.watchId 必填（唯一键 watchId+source+externalId），
// 因此给每个用户懒建一个 enabled=false 的「我的收录」watch 作为挂载点——
// worker 调度器只扫 enabled 的 watch，不会误跑它。
// source 固定为 user（手动）/ import（链接导入），externalId 用 URL 哈希，
// 并在全库范围按 URL 查重，避免用户重复灌入总库。

import { createHash } from "node:crypto";
import { prisma } from "@careeros/db";

export const SUBMIT_WATCH_NAME = "我的收录";
export const USER_SOURCES = ["user", "import"] as const;

/** 懒建用户专属的「我的收录」watch（enabled=false，不参与自动抓取调度）。 */
export async function ensureSubmitWatch(userId: string) {
  const existing = await prisma.jobWatch.findFirst({
    where: { userId, name: SUBMIT_WATCH_NAME },
    select: { id: true },
  });
  if (existing) return existing;
  return prisma.jobWatch.create({
    data: {
      userId,
      name: SUBMIT_WATCH_NAME,
      keywords: [],
      sources: [],
      enabled: false, // 关键：不让 worker 调度它
      intervalMinutes: 525_600, // 兜底：即使被误开启，一年才轮询一次
    },
    select: { id: true },
  });
}

/** URL 规范化（去 hash、去尾斜杠、去常见跟踪参数），用于查重与 externalId。 */
export function normalizeJobUrl(raw: string): string {
  try {
    const u = new URL(raw.trim());
    u.hash = "";
    const drop = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "spm", "from"];
    drop.forEach((k) => u.searchParams.delete(k));
    let s = u.toString();
    if (s.endsWith("/")) s = s.slice(0, -1);
    return s;
  } catch {
    return raw.trim();
  }
}

export function urlExternalId(url: string): string {
  return "u-" + createHash("sha256").update(normalizeJobUrl(url)).digest("hex").slice(0, 40);
}

/** 全库按 URL 查重（含自动抓取的数据），返回已存在的岗位摘要或 null。 */
export async function findDuplicateByUrl(url: string) {
  const norm = normalizeJobUrl(url);
  return prisma.discoveredJob.findFirst({
    where: { url: { in: [norm, norm + "/", url.trim()] } },
    select: { id: true, title: true, company: true, source: true, createdAt: true },
  });
}
