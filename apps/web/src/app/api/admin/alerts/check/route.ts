import { prisma, runCostAlertCheck } from "@careeros/db";
import { handler, ok, requireAdmin } from "@/lib/api";

// 立即检查（不依赖 worker 定时器）：跑一次成本告警检查并返回结果。
export const POST = handler(async () => {
  await requireAdmin();
  return ok(await runCostAlertCheck(prisma));
});
