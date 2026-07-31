import { z } from "zod";
import { prisma, type AdminAction } from "@careeros/db";
import { handler, ok, parseBody, requireAdmin, ApiError } from "@/lib/api";
import { logAdminAction } from "@/lib/admin/audit";

const actionInput = z.discriminatedUnion("action", [
  z.object({ action: z.literal("set_role"), role: z.enum(["guest", "user", "recruiter", "admin", "enterprise"]), reason: z.string().max(500).optional() }),
  z.object({ action: z.literal("soft_delete"), reason: z.string().max(500).optional() }),
  z.object({ action: z.literal("restore"), reason: z.string().max(500).optional() }),
  z.object({ action: z.literal("ban"), reason: z.string().max(500).optional() }),
  z.object({ action: z.literal("unban"), reason: z.string().max(500).optional() }),
]);

const iso = (d: Date | null) => (d ? d.toISOString() : null);

export const POST = handler(async (req, ctx) => {
  const { userId: actorId } = await requireAdmin();
  const { id } = await ctx.params;
  const input = await parseBody(req, actionInput);

  // 自我保护：管理员不能对自己改角色/封禁/软删，避免把自己锁在外面。
  if (id === actorId) throw new ApiError(400, "self_action", "不能对自己执行管理操作");

  const target = await prisma.user.findUnique({
    where: { id },
    select: { id: true, role: true, deletedAt: true, bannedAt: true },
  });
  if (!target) throw new ApiError(404, "not_found", "用户不存在");

  const before = { role: target.role, deletedAt: iso(target.deletedAt), bannedAt: iso(target.bannedAt) };
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;

  let action: AdminAction;
  let after: Record<string, unknown>;
  switch (input.action) {
    case "set_role":
      await prisma.user.update({ where: { id }, data: { role: input.role } });
      action = "user_role_change";
      after = { role: input.role };
      break;
    case "soft_delete":
      await prisma.user.update({ where: { id }, data: { deletedAt: new Date() } });
      action = "user_soft_delete";
      after = { deletedAt: "set" };
      break;
    case "restore":
      await prisma.user.update({ where: { id }, data: { deletedAt: null } });
      action = "user_restore";
      after = { deletedAt: null };
      break;
    case "ban":
      await prisma.user.update({ where: { id }, data: { bannedAt: new Date() } });
      action = "user_ban";
      after = { bannedAt: "set" };
      break;
    case "unban":
      await prisma.user.update({ where: { id }, data: { bannedAt: null } });
      action = "other"; // enum 无 unban，用 other + reason 记录
      after = { bannedAt: null };
      break;
  }

  await logAdminAction({ actorId, action, targetType: "user", targetId: id, before, after, reason: input.reason ?? null, ip });
  return ok({ ok: true });
});
