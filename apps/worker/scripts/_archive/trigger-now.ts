import { Queue } from "bullmq";
import { prisma } from "@careeros/db";

const connection = { host: "localhost", port: 6380 };
const q = new Queue("watch", { connection });

const ai = await prisma.jobWatch.findFirst({
  where: { name: { contains: "AI" } },
  orderBy: { createdAt: "desc" },
});
if (!ai) {
  console.log("未找到 AI watch");
  process.exit(1);
}
await q.add("watch_poll", { watchId: ai.id }, { jobId: `manual-${Date.now()}` });
console.log(`已入队 watch_poll（强制）-> AI 岗位追踪 ${ai.id}`);
await q.close();
await prisma.$disconnect();
process.exit(0);
