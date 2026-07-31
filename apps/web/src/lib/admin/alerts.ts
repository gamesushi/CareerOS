import { prisma } from "@careeros/db";

const ID = "cost";

export async function getAlertConfig() {
  const cfg = await prisma.alertConfig.findUnique({ where: { id: ID } });
  return {
    enabled: cfg?.enabled ?? false,
    dailyThresholdUsd: cfg ? Number(cfg.dailyThresholdUsd) : 0,
    webhookUrl: cfg?.webhookUrl ?? null,
    lastFiredOn: cfg?.lastFiredOn ?? null,
    updatedAt: cfg?.updatedAt ?? null,
  };
}

export async function setAlertConfig(
  data: { enabled: boolean; dailyThresholdUsd: number; webhookUrl: string | null },
  actorId: string,
) {
  return prisma.alertConfig.upsert({
    where: { id: ID },
    create: { id: ID, enabled: data.enabled, dailyThresholdUsd: data.dailyThresholdUsd, webhookUrl: data.webhookUrl, updatedById: actorId },
    update: { enabled: data.enabled, dailyThresholdUsd: data.dailyThresholdUsd, webhookUrl: data.webhookUrl, updatedById: actorId },
  });
}
