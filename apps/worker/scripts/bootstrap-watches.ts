/**
 * Bootstrap JobWatches for real production scraping.
 *
 * 按语言把全部「零凭据公开 JSON 源」分成三组 watch（中文 / 英文 / 日文），
 * 用系统账户 crawler@careeros.local 归属，创建后立即入队 watch 队列，
 * 由 worker 的 watch_poll 任务真实抓取并写入 discovered_jobs。
 *
 * 排除真·空实现的源：boss（登录墙需用户 cookie）/ efund（官网无公开招聘接口）。
 * Playwright SPA 源（liepin / mihoyo / pingan / cmb）单独成组 CN-SPA：
 *   - 需要已安装 chromium（pnpm --filter worker exec playwright install chromium）
 *   - 这些源返回全量列表、由 watchPoll 按关键词过滤 title/snippet，
 *     所以关键词铺宽（含「经理/专员/岗」等），否则银行/保险类岗位会被误杀。
 *
 * 运行：pnpm --filter worker exec tsx scripts/bootstrap-watches.ts
 */
import { prisma } from "@careeros/db";
import { WATCH_SOURCES } from "@careeros/shared";
import { Queue } from "bullmq";

// 真·空实现的源，跳过（不污染 lastError）
const EMPTY_IMPL = new Set(["boss", "efund"]);
// Playwright 无头浏览器源（中文 SPA 站），单独成组、宽关键词
const SPA_IDS = ["liepin", "mihoyo", "pingan", "cmb"];
const EXCLUDE = new Set([...EMPTY_IMPL, ...SPA_IDS]);

// 中文站（腾讯 / 字节）。网易游戏走 Greenhouse 英文接口，归入英文组。
const cnIds = WATCH_SOURCES.filter(
  (s) => s.region === "china" && !EXCLUDE.has(s.id) && s.id !== "netease",
).map((s) => s.id);

// 美国 / 英国 / 其它国家：Greenhouse / Lever / RemoteOK / HN 等公开 JSON 源
const enIds = WATCH_SOURCES.filter(
  (s) =>
    (s.region === "usa" || s.region === "uk" || s.region === "other") &&
    !EXCLUDE.has(s.id),
).map((s) => s.id);
if (WATCH_SOURCES.some((s) => s.id === "netease")) enIds.push("netease");

// 日本站（Green / Wantedly / Nintendo / 万代南梦宫 / Indeed）
const jpIds = WATCH_SOURCES.filter(
  (s) => s.region === "japan" && !EXCLUDE.has(s.id),
).map((s) => s.id);

const WATCHES = [
  { name: "Bootstrap CN", sources: cnIds, keywords: ["工程师", "产品经理"] },
  { name: "Bootstrap EN", sources: enIds, keywords: ["engineer", "product manager"] },
  { name: "Bootstrap JP", sources: jpIds, keywords: ["エンジニア", "開発"] },
  // Playwright SPA 源：返回全量列表，关键词铺宽以免银行/保险/游戏岗被过滤误杀
  {
    name: "Bootstrap CN-SPA",
    sources: SPA_IDS.filter((id) => WATCH_SOURCES.some((s) => s.id === id)),
    keywords: ["工程师", "开发", "经理", "专员", "岗", "设计", "运营", "美术", "策划", "测试"],
  },
];

async function main() {
  console.log(
    `source groups -> CN:${cnIds.length} EN:${enIds.length} JP:${jpIds.length}`,
  );

  // 系统抓取账户，作为所有 watch / discovered_job 的归属
  const sysUser = await prisma.user.upsert({
    where: { email: "crawler@careeros.local" },
    update: {},
    create: { email: "crawler@careeros.local", name: "crawler" },
  });

  const redisUrl = new URL(process.env.REDIS_URL ?? "redis://localhost:6380");
  const queue = new Queue("watch", {
    connection: {
      host: redisUrl.hostname,
      port: Number(redisUrl.port || 6379),
      maxRetriesPerRequest: null,
    },
  });

  for (const w of WATCHES) {
    const existing = await prisma.jobWatch.findFirst({ where: { name: w.name } });
    const watch = existing
      ? await prisma.jobWatch.update({
          where: { id: existing.id },
          data: { sources: w.sources, keywords: w.keywords, enabled: true, lastRunAt: null },
        })
      : await prisma.jobWatch.create({
          data: {
            userId: sysUser.id,
            name: w.name,
            sources: w.sources,
            keywords: w.keywords,
            enabled: true,
            intervalMinutes: 60,
          },
        });
    await queue.add("watch_poll", { watchId: watch.id });
    console.log(
      `✓ enqueued "${w.name}": ${w.sources.length} sources × ${w.keywords.length} keywords -> watchId ${watch.id}`,
    );
  }

  await queue.close();
  await prisma.$disconnect();
  console.log("bootstrap done. worker 将开始真实抓取。");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
