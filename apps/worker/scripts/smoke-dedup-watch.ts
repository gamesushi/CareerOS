// 真实 worker 链路冒烟：用 4 个整板型源 × 5 关键词建临时 watch（enabled=false，调度器不碰），
// 清空 watch 队列后手动触发 watch_poll，等其完成并核对入库数，最后删除。验证新去重代码路径无运行时错误。
import { prisma } from "@careeros/db";
import { Queue } from "bullmq";
import { HARVESTED } from "../src/sources/harvested";

const REDIS = { host: "localhost", port: 6380 };

async function main() {
  const ids = Object.keys(HARVESTED).slice(0, 4);
  console.log("选用来源:", ids.join(", "));

  // 清空队列残留
  const q = new Queue("watch", { connection: REDIS });
  await q.drain();
  console.log("队列已清空");

  // 取一个真实 userId（JobWatch.userId 是 User 外键 UUID）
  const anyWatch = await prisma.jobWatch.findFirst({ select: { userId: true } });
  if (!anyWatch) throw new Error("无可用 userId");
  const userId = anyWatch.userId;

  // 建临时 watch（UUID 由 Prisma 生成）
  const w = await prisma.jobWatch.create({
    data: {
      name: "SMOKE-DEDUP",
      enabled: false,
      sources: ids,
      keywords: ["", "engineer", "python", "data", "go"],
      userId,
      intervalMinutes: 60,
    },
  });
  const TEMP_ID = w.id;
  await prisma.discoveredJob.deleteMany({ where: { watchId: TEMP_ID } });
  console.log("临时 watch 已建（enabled=false）:", TEMP_ID);

  // 触发
  await q.add("watch_poll", { watchId: TEMP_ID }, { jobId: `smoke-${Date.now()}` });
  console.log("已触发 watch_poll");

  // 轮询直到该 watch 被处理（lastRunAt 有值）或超时 120s
  const t0 = Date.now();
  let done = false;
  let count = -1;
  while (Date.now() - t0 < 120_000) {
    await new Promise((r) => setTimeout(r, 3000));
    const cur = await prisma.jobWatch.findUnique({ where: { id: TEMP_ID } });
    count = await prisma.discoveredJob.count({ where: { watchId: TEMP_ID } });
    if (cur?.lastRunAt) {
      done = true;
      console.log("worker 已完成：", cur.lastResult, "| 入库数=", count, "| lastError=", cur.lastError);
      break;
    }
  }
  if (!done) console.log("超时未完成（可能 worker 正忙或被调度器抢占）；当前入库数=", count);

  // 清理
  await prisma.discoveredJob.deleteMany({ where: { watchId: TEMP_ID } });
  await prisma.jobWatch.delete({ where: { id: TEMP_ID } });
  console.log("临时 watch 已清理");
  await q.close();
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("SMOKE ERROR:", e);
  process.exit(1);
});
