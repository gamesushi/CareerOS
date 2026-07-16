import { prisma } from "@careeros/db";
import { skillInput, normalizeSkill } from "@careeros/shared";
import { handler, ok, parseBody, requireUser, ApiError } from "@/lib/api";

async function findOwned(userId: string, id: string) {
  const row = await prisma.skill.findFirst({ where: { id, userId } });
  if (!row) throw new ApiError(404, "not_found", "技能不存在");
  return row;
}

export const GET = handler(async (_req, { params }) => {
  const { userId } = await requireUser();
  const { id } = await params;
  await findOwned(userId, id);
  const data = await prisma.skill.findUnique({
    where: { id },
    include: { evidences: { orderBy: { createdAt: "desc" } } },
  });
  return ok(data);
});

export const PUT = handler(async (req, { params }) => {
  const { userId } = await requireUser();
  const { id } = await params;
  await findOwned(userId, id);
  const input = await parseBody(req, skillInput);
  const updated = await prisma.skill.update({
    where: { id },
    data: {
      name: input.name,
      nameNorm: normalizeSkill(input.name),
      category: input.category,
      // 用户显式给 level 即视为手动覆写（ADR：AI 推算不再覆盖）
      ...(input.level != null ? { level: input.level, levelSource: "manual" as const } : {}),
    },
  });
  return ok(updated);
});

export const DELETE = handler(async (_req, { params }) => {
  const { userId } = await requireUser();
  const { id } = await params;
  await findOwned(userId, id);
  await prisma.skill.delete({ where: { id } });
  return ok({ deleted: true });
});
