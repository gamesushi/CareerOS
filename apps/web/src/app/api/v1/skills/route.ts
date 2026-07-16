import { prisma } from "@careeros/db";
import { skillInput, normalizeSkill } from "@careeros/shared";
import { handler, ok, parseBody, requireUser, ApiError } from "@/lib/api";

export const GET = handler(async () => {
  const { userId } = await requireUser();
  const data = await prisma.skill.findMany({
    where: { userId },
    orderBy: [{ level: "desc" }, { name: "asc" }],
    include: { _count: { select: { evidences: true } } },
  });
  return ok({
    data: data.map(({ _count, ...s }) => ({ ...s, evidenceCount: _count.evidences })),
  });
});

export const POST = handler(async (req) => {
  const { userId } = await requireUser();
  const input = await parseBody(req, skillInput);
  const nameNorm = normalizeSkill(input.name);

  const existing = await prisma.skill.findUnique({
    where: { userId_nameNorm: { userId, nameNorm } },
  });
  if (existing) throw new ApiError(409, "duplicate", `技能「${existing.name}」已存在`, { id: existing.id });

  const created = await prisma.skill.create({
    data: {
      userId,
      name: input.name,
      nameNorm,
      category: input.category,
      level: input.level ?? 0,
      levelSource: input.level != null ? "manual" : "ai",
    },
  });
  return ok(created, 201);
});
