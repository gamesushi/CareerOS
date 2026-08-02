import { Queue } from "bullmq";
import { prisma } from "@careeros/db";
import { HARVESTED_IDS } from "../src/sources/harvested";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const q = new Queue("watch", { connection: { host: "localhost", port: 6380 } });
  try {
    await q.drain();
    console.log("watch 队列残留 job 已清空");
  } catch (e) {
    console.log("drain 跳过:", (e as Error).message);
  }

  const user = await prisma.user.findFirst();
  if (!user) {
    console.log("无用户");
    process.exit(1);
  }
  const tmp = await prisma.jobWatch.create({
    data: {
      userId: user.id,
      name: "TEMP-HV",
      sources: HARVESTED_IDS,
      keywords: [""],
      enabled: true,
      intervalMinutes: 1,
    },
  });
  await q.add("watch_poll", { watchId: tmp.id }, { jobId: `hv-${Date.now()}` });
  console.log(`临时 watch 已建并触发 ${tmp.id}，新来源=${HARVESTED_IDS.length}`);

  let prev = -1;
  let stable = 0;
  let last = 0;
  for (let i = 0; i < 60; i++) {
    await sleep(5000);
    last = await prisma.discoveredJob.count({ where: { watchId: tmp.id } });
    if (i % 4 === 0 || last > 0) console.log(`  t=${(i + 1) * 5}s  岗位数=${last}`);
    if (last > 0 && last === prev) {
      if (++stable >= 3) break;
    } else stable = 0;
    prev = last;
  }

  const bySrc = await prisma.discoveredJob.groupBy({
    by: ["source"],
    where: { watchId: tmp.id },
    _count: { _all: true },
    orderBy: { _count: { source: "desc" } },
    take: 15,
  });
  console.log("\nTop15 来源分布:");
  for (const r of bySrc) console.log(`  ${r.source.padEnd(22)} ${r._count._all}`);

  await prisma.jobWatch.delete({ where: { id: tmp.id } });
  console.log(`\n临时 watch 已删除。结论：154 个新来源全量抓取到 ${last} 个在招岗位。`);
  await q.close();
  await prisma.$disconnect();
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
