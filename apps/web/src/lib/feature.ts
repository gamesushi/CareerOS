import { createHash } from "node:crypto";
import { prisma } from "@careeros/db";

/**
 * 运行时判定某灰度开关对某用户是否开启。
 * enabled 为前提；rolloutPercent<100 时按 (key:userId) 稳定哈希分桶放量，无用户上下文则视为关闭。
 */
export async function isFeatureEnabled(key: string, userId?: string): Promise<boolean> {
  const f = await prisma.featureFlag.findUnique({ where: { key }, select: { enabled: true, rolloutPercent: true } });
  if (!f || !f.enabled) return false;
  if (f.rolloutPercent >= 100) return true;
  if (f.rolloutPercent <= 0) return false;
  if (!userId) return false;
  const bucket = createHash("sha256").update(`${key}:${userId}`).digest().readUInt16BE(0) % 100;
  return bucket < f.rolloutPercent;
}
