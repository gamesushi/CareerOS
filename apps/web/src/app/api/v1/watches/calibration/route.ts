import { prisma } from "@careeros/db";
import { handler, ok, requireUser } from "@/lib/api";

// 画像校准顾问：统计用户已评分发现岗位的 fit 分分布，给出「太严/太宽/良好」判定，
// 引导用户调整监测关键词与档案（对齐 SearchSteward 的 calibration advisor）。
export const GET = handler(async () => {
  const { userId } = await requireUser();
  const base = { userId, takenDownAt: null } as const;

  const [strong, moderate, weak, unscored] = await Promise.all([
    prisma.discoveredJob.count({ where: { ...base, matchScore: { gte: 60 } } }),
    prisma.discoveredJob.count({ where: { ...base, matchScore: { gte: 30, lt: 60 } } }),
    prisma.discoveredJob.count({ where: { ...base, matchScore: { gt: 0, lt: 30 } } }),
    prisma.discoveredJob.count({ where: { ...base, matchScore: null } }),
  ]);
  const scored = strong + moderate + weak;

  let verdict: "no_data" | "too_strict" | "too_broad" | "good";
  if (scored === 0) verdict = "no_data";
  else if (strong === 0 && scored >= 15) verdict = "too_strict";
  else if (strong / scored > 0.7) verdict = "too_broad";
  else verdict = "good";

  return ok({ data: { strong, moderate, weak, unscored, scored, verdict } });
});
