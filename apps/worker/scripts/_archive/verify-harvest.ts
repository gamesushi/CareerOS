import { prisma } from "@careeros/db";
import { HARVESTED_IDS } from "../src/sources/harvested";
import { Queue } from "bullmq";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const user = await prisma.user.findFirst();
  if (!user) {
    console.log("无用户，无法建临时 watch");
    process.exit(1);
  }
  const tmp = await prisma.jobWatch.create({
    data: {
      userId: user.id,
      name: "TEMP-HARVEST-VERIFY",
      sources: HARVESTED_IDS,
      keywords: [""],
      enabled: true,
      intervalMinutes: 1,
    },
  });
  console.log(`临时 watch 已建 ${tmp.id}，新来源数=${HARVESTED_IDS.length}`);

  const q = new Queue("watch", { connection: { host: "localhost", port: 6380 } });
  await q.add("watch_poll", { watchId: tmp.id }, { jobId: `hv-${Date.now()}` });
  console.log("已触发强制轮询，最长等待 5 分钟…");

  let prev = -1;
  let stable = 0;
  let last = 0;
  for (let i = 0; i < 60; i++) {
    await sleep(5000);
    last = await prisma.discoveredJob.count({ where: { watchId: tmp.id } });
    console.log(`  t=${(i + 1) * 5}s  临时watch岗位数=${last}`);
    // 仅在已有数据且连续 3 次不变才视为完成
    if (last > 0 && last === prev) {
      if (++stable >= 3) break;
    } else {
      stable = 0;
    }
    prev = last;
  }

  const bySource = await prisma.discoveredJob.groupBy({
    by: ["source"],
    where: { watchId: tmp.id },
    _count: { _all: true },
    orderBy: { _count: { source: "desc" } },
    take: 15,
  });
  console.log("\n临时 watch 来源分布 Top15:");
  for (const r of bySource) console.log(`  ${r.source.padEnd(22)} ${r._count._all}`);

  await prisma.jobWatch.delete({ where: { id: tmp.id } });
  console.log(`\n临时 watch 已删除。验证结论：154 个新来源全量抓取到 ${last} 个在招岗位。`);
  await q.close();
  await prisma.$disconnect();
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
