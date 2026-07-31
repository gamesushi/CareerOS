import { z } from "zod";
import { prisma } from "@careeros/db";
import { handler, ok, parseBody, requireAdmin, ApiError } from "@/lib/api";
import { logAdminAction } from "@/lib/admin/audit";

const createInput = z.object({
  key: z.string().min(1).max(64).regex(/^[a-z0-9_.-]+$/i, "只允许字母数字与 _.-"),
  description: z.string().max(300).optional(),
});

export const POST = handler(async (req) => {
  const { userId } = await requireAdmin();
  const { key, description } = await parseBody(req, createInput);
  if (await prisma.featureFlag.findUnique({ where: { key } })) throw new ApiError(409, "exists", "该 key 已存在");
  const f = await prisma.featureFlag.create({ data: { key, description: description ?? null, updatedById: userId } });
  await logAdminAction({ actorId: userId, action: "other", targetType: "feature_flag", targetId: f.id, after: { key, created: true }, reason: `创建开关 ${key}` });
  return ok({ ok: true, id: f.id });
});
