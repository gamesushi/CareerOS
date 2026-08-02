import { prisma, Prisma } from "@careeros/db";
import { SOURCES, SOURCE_IDS } from "../src/sources";

async function main() {
  // ---- 来源注册情况 ----
  const byCategory: Record<string, number> = {};
  for (const id of SOURCE_IDS) {
    const s = SOURCES[id];
    const cat = s.category ?? "general/manual";
    byCategory[cat] = (byCategory[cat] ?? 0) + 1;
  }
  console.log("=== 已注册来源 (SOURCE_IDS) ===");
  console.log("总数:", SOURCE_IDS.length);
  console.log("按品类亲和:", JSON.stringify(byCategory, null, 2));

  // 来源适配器家族（按文件归类，纯静态推断）
  const files = ["greenhouse.ts", "finance.ts", "tech.ts", "lever.ts", "tencent.ts", "bytedance.ts", "liepin.ts", "boss.ts", "green.ts", "indeed.ts", "wantedly.ts", "remoteok.ts", "hackernews.ts", "mihoyo.ts"];
  console.log("适配器文件:", files.join(", "));

  // ---- DB 实际岗位覆盖 ----
  const total = await prisma.discoveredJob.count();
  const closed = await prisma.discoveredJob.count({ where: { closedAt: { not: null } } });
  const open = total - closed;
  const withPub = await prisma.discoveredJob.count({ where: { publishedAt: { not: null } } });

  const bySource = await prisma.discoveredJob.groupBy({ by: ["source"], _count: { _all: true } });
  bySource.sort((a, b) => b._count._all - a._count._all);

  const companyAgg = await prisma.discoveredJob.aggregate({ _count: { company: true } });
  const distinctCompany = await prisma.$queryRaw<{ c: bigint }>`SELECT COUNT(DISTINCT company)::bigint AS c FROM "discovered_jobs" WHERE company IS NOT NULL`;
  const distinctSourceUsed = new Set(bySource.map((b) => b.source));

  console.log("\n=== DiscoveredJob 实库覆盖 ===");
  console.log("总岗位数:", total, "| 在招(open):", open, "| 已停招(closed):", closed, "| 含发布时间:", withPub);
  console.log("去重公司数(有公司名):", Number(distinctCompany[0].c));
  console.log("涉及来源数:", distinctSourceUsed.size, "/ 已注册", SOURCE_IDS.length);

  console.log("\n--- 按来源 Top (source: count) ---");
  for (const b of bySource.slice(0, 30)) {
    console.log(`  ${b.source.padEnd(16)} ${b._count._all}`);
  }
  if (bySource.length > 30) console.log(`  ... 共 ${bySource.length} 个来源`);

  // ---- 监测任务 (JobWatch) ----
  const watchCount = await prisma.jobWatch.count();
  const watches = await prisma.jobWatch.findMany({ select: { sources: true, keywords: true, enabled: true } });
  const usedSourceIds = new Set<string>();
  let enabledWatches = 0;
  let totalKeywordRefs = 0;
  for (const w of watches) {
    if (w.enabled) enabledWatches++;
    (w.sources as string[]).forEach((s) => usedSourceIds.add(s));
    totalKeywordRefs += (w.keywords as string[]).length;
  }
  console.log("\n=== JobWatch 监测任务 ===");
  console.log("任务总数:", watchCount, "| 启用:", enabledWatches);
  console.log("被监测任务引用的来源数:", usedSourceIds.size);
  console.log("关键词引用总数:", totalKeywordRefs);
  const unused = SOURCE_IDS.filter((id) => !usedSourceIds.has(id));
  console.log("已注册但当前无监测任务引用的来源数:", unused.length, unused.length ? `(如 ${unused.slice(0, 8).join(", ")}…)` : "");
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
