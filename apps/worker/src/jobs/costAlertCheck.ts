import { prisma, runCostAlertCheck } from "@careeros/db";

// 定时成本告警检查（web 的「立即检查」与此共用 runCostAlertCheck）。
// 返回与 watch 完成回调一致的形状，避免事件处理器读取 undefined。
export async function handleCostAlertJob(): Promise<{ scanned: number; found: number }> {
  const r = await runCostAlertCheck(prisma);
  if (r.status === "fired") console.log(`[alert] cost alert fired: $${r.cost.toFixed(4)} >= $${r.threshold.toFixed(4)}`);
  else if (r.status === "webhook_error") console.error(`[alert] cost alert webhook failed (cost $${r.cost.toFixed(4)})`);
  return { scanned: 0, found: 0 };
}
