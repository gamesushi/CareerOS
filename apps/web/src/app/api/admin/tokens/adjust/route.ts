// 管理员调节某用户 token 余额：grant（发放/模拟充值）或 deduct（扣减校正）。
// 仅管理员可调用（requireAdmin 门禁）；操作后返回变动后的余额。

import { z } from "zod";
import { handler, ok, parseBody, requireAdmin } from "@/lib/api";
import { grantTokens } from "@/lib/tokens";

const adjustInput = z.object({
  userId: z.string().min(1),
  action: z.enum(["grant", "deduct"]),
  amount: z.number().int().positive().max(10_000_000),
  note: z.string().max(200).optional(),
});

export const POST = handler(async (req) => {
  await requireAdmin();
  const { userId, action, amount, note } = await parseBody(req, adjustInput);
  const balance = await grantTokens(userId, amount, action, note);
  return ok({ userId, action, balance });
});
