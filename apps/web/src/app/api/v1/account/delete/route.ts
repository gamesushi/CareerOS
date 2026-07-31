import { handler, ok, requireUser } from "@/lib/api";
import { prisma } from "@careeros/db";

// 用户自助注销（PIPL 要求提供便捷的账号删除渠道）。
// 软删除：置 deletedAt，并把 email 改为带删除标记的后缀以释放原邮箱（允许将来同邮箱重注册）。
// 所有业务查询经 requireUser 已按 deletedAt 拦截，旧会话立即失效。
export const POST = handler(async () => {
  const { userId } = await requireUser();
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.deletedAt) return ok({ ok: true });

  const ts = Date.now();
  await prisma.user.update({
    where: { id: userId },
    data: {
      deletedAt: new Date(),
      email: `${user.email}#deleted-${ts}`,
    },
  });

  // 写入一条「自助注销」审计，便于后续安全排查
  await prisma.loginLog.create({
    data: { userId, email: user.email, method: "dev", success: false, reason: "self_deleted" },
  });

  return ok({ ok: true });
});
