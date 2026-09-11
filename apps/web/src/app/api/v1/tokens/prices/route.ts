// 模型价格表（当前登录用户可查看，用于设置页价格弹层）。

import { handler, ok, requireUser } from "@/lib/api";
import { prisma } from "@careeros/db";

export const GET = handler(async () => {
  await requireUser();
  const prices = await prisma.tokenPrice.findMany({ orderBy: { model: "asc" } });
  return ok(
    prices.map((p) => ({
      model: p.model,
      label: p.label,
      inPer1k: Number(p.inPer1k),
      outPer1k: Number(p.outPer1k),
      currency: p.currency,
    })),
  );
});
