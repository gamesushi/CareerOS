// 自助角色切换：user ↔ recruiter，用于「我要发岗 / 我不发岗了」。
//
// 刻意只允许这两个值互切：admin 与 enterprise 由管理员在后台设定，
// 若允许自助改会出现「管理员误把自己降权」和「自助提权到 enterprise」两个坑。
// 切换后无需重新登录即时生效——所有门禁（requireRole / layout）都查 DB。

import { z } from "zod";
import { prisma } from "@careeros/db";
import { handler, ok, parseBody, requireUser, ApiError } from "@/lib/api";

const input = z.object({ role: z.enum(["user", "recruiter"]) });

export const PUT = handler(async (req) => {
  const { userId } = await requireUser();
  const { role } = await parseBody(req, input);

  const current = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  if (!current) throw new ApiError(404, "not_found", "用户不存在");
  if (current.role !== "user" && current.role !== "recruiter") {
    throw new ApiError(403, "role_locked", "当前账号角色由管理员管理，无法自助切换");
  }

  await prisma.user.update({ where: { id: userId }, data: { role } });
  return ok({ role });
});
