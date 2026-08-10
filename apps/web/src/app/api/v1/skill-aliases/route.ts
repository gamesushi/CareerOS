import { z } from "zod";
import { prisma } from "@careeros/db";
import { normalizeSkill } from "@careeros/shared";
import { handler, ok, parseBody, requireUser, ApiError } from "@/lib/api";

const aliasInput = z.object({
  aliasName: z.string().min(1).max(80),
  skillId: z.string().min(1),
  note: z.string().max(200).optional(),
});

// 列出当前用户的所有技能同义别名（带映射到的技能名）
export const GET = handler(async () => {
  const { userId } = await requireUser();
  const data = await prisma.skillAlias.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
    include: { skill: { select: { id: true, name: true } } },
  });
  return ok({ data });
});

// 新增一条别名：JD 技能名(aliasName) → 用户已有技能(skillId)
export const POST = handler(async (req) => {
  const { userId } = await requireUser();
  const input = await parseBody(req, aliasInput);
  const aliasNorm = normalizeSkill(input.aliasName);

  const skill = await prisma.skill.findFirst({ where: { id: input.skillId, userId } });
  if (!skill) throw new ApiError(404, "skill_not_found", "目标技能不存在");

  const existing = await prisma.skillAlias.findUnique({
    where: { userId_aliasNorm: { userId, aliasNorm } },
  });
  if (existing) {
    throw new ApiError(409, "duplicate", `别名「${input.aliasName}」已存在`, { id: existing.id });
  }

  const created = await prisma.skillAlias.create({
    data: { userId, aliasNorm, skillId: input.skillId, note: input.note },
  });
  return ok(created, 201);
});
