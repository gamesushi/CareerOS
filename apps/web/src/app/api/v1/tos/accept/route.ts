import { prisma } from "@careeros/db";
import { handler, ok, requireUser } from "@/lib/api";
import { CURRENT_TOS_VERSION } from "@/lib/tos";

/**
 * POST /api/v1/tos/accept
 * 记录当前登录用户对最新版《用户协议》《隐私政策》的同意（时间 + 版本留痕）。
 * 用于：条款版本更新后的重确认弹窗（TosGate）、以及未经登录页勾选进入的会话补确认。
 */
export const POST = handler(async () => {
  const { userId } = await requireUser();
  const user = await prisma.user.update({
    where: { id: userId },
    data: { tosAcceptedAt: new Date(), tosVersion: CURRENT_TOS_VERSION },
    select: { tosAcceptedAt: true, tosVersion: true },
  });
  return ok(user);
});
