import { z } from "zod";
import { prisma } from "@careeros/db";
import { handler, ok, parseBody, requireAdmin, ApiError } from "@/lib/api";
import { logAdminAction } from "@/lib/admin/audit";

const patchInput = z.object({
  enabled: z.boolean().optional(),
  rolloutPercent: z.number().int().min(0).max(100).optional(),
  description: z.string().max(300).nullable().optional(),
});

export const PATCH = handler(async (req, ctx) => {
  const { userId } = await requireAdmin();
  const { id } = await ctx.params;
  const input = await parseBody(req, patchInput);

  const before = await prisma.featureFlag.findUnique({ where: { id } });
  if (!before) throw new ApiError(404, "not_found", "开关不存在");

  const f = await prisma.featureFlag.update({
    where: { id },
    data: {
      ...(input.enabled !== undefined ? { enabled: input.enabled } : {}),
      ...(input.rolloutPercent !== undefined ? { rolloutPercent: input.rolloutPercent } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      updatedById: userId,
    },
  });
  await logAdminAction({
    actorId: userId,
    action: "other",
    targetType: "feature_flag",
    targetId: id,
    before: { enabled: before.enabled, rolloutPercent: before.rolloutPercent },
    after: { enabled: f.enabled, rolloutPercent: f.rolloutPercent },
    reason: `更新开关 ${f.key}`,
  });
  return ok({ ok: true });
});
