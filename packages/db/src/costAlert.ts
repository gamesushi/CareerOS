import type { PrismaClient } from "@prisma/client";

export type CostCheckResult = {
  status: "disabled" | "below" | "already_fired" | "exceeded_no_webhook" | "webhook_error" | "fired";
  cost: number;
  threshold: number;
};

// 成本告警检查（web 的「立即检查」与 worker 定时任务共用）：
// 当日 AI 成本 ≥ 阈值且当天未发过时，向 webhook 发一次通知并记录 lastFiredOn。
export async function runCostAlertCheck(prisma: PrismaClient): Promise<CostCheckResult> {
  const cfg = await prisma.alertConfig.findUnique({ where: { id: "cost" } });
  const today = new Date().toISOString().slice(0, 10);
  const todayStart = new Date(`${today}T00:00:00.000Z`);

  const agg = await prisma.aiRun.aggregate({ _sum: { costUsd: true }, where: { createdAt: { gte: todayStart } } });
  const cost = agg._sum.costUsd == null ? 0 : Number(agg._sum.costUsd);
  const threshold = cfg ? Number(cfg.dailyThresholdUsd) : 0;

  if (!cfg || !cfg.enabled) return { status: "disabled", cost, threshold };
  if (cost < threshold) return { status: "below", cost, threshold };
  if (cfg.lastFiredOn === today) return { status: "already_fired", cost, threshold };
  if (!cfg.webhookUrl) return { status: "exceeded_no_webhook", cost, threshold };

  try {
    await fetch(cfg.webhookUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: `⚠️ uCareerOS：今日 AI 成本 $${cost.toFixed(4)} 已达阈值 $${threshold.toFixed(4)}（${today}）` }),
    });
  } catch {
    return { status: "webhook_error", cost, threshold };
  }

  await prisma.alertConfig.update({ where: { id: "cost" }, data: { lastFiredOn: today } });
  return { status: "fired", cost, threshold };
}
