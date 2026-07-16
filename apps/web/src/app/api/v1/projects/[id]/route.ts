import { prisma } from "@careeros/db";
import { projectInput } from "@careeros/shared";
import { handler, ok, parseBody, requireUser, toDate, ApiError } from "@/lib/api";

async function findOwned(userId: string, id: string) {
  const row = await prisma.project.findFirst({ where: { id, userId, deletedAt: null } });
  if (!row) throw new ApiError(404, "not_found", "项目不存在");
  return row;
}

export const GET = handler(async (_req, { params }) => {
  const { userId } = await requireUser();
  const { id } = await params;
  await findOwned(userId, id);
  const data = await prisma.project.findUnique({
    where: { id },
    include: {
      experience: { select: { id: true, company: true, title: true } },
      skills: { include: { skill: { select: { id: true, name: true } } } },
      achievements: true,
    },
  });
  return ok(data);
});

export const PUT = handler(async (req, { params }) => {
  const { userId } = await requireUser();
  const { id } = await params;
  await findOwned(userId, id);
  const input = await parseBody(req, projectInput);

  const updated = await prisma.$transaction(async (tx) => {
    await tx.projectSkill.deleteMany({ where: { projectId: id } });
    return tx.project.update({
      where: { id },
      data: {
        experienceId: input.experienceId ?? null,
        name: input.name,
        role: input.role,
        startDate: toDate(input.startDate),
        endDate: toDate(input.endDate),
        description: input.description,
        outcome: input.outcome,
        links: input.links,
        techStack: input.techStack,
        lang: input.lang,
        sortOrder: input.sortOrder,
        skills: { create: input.skillIds.map((skillId) => ({ skillId })) },
      },
      include: { skills: { include: { skill: { select: { id: true, name: true } } } } },
    });
  });
  await prisma.careerProfile.updateMany({ where: { userId }, data: { isStale: true } });
  return ok(updated);
});

export const DELETE = handler(async (_req, { params }) => {
  const { userId } = await requireUser();
  const { id } = await params;
  await findOwned(userId, id);
  await prisma.project.update({ where: { id }, data: { deletedAt: new Date() } });
  return ok({ deleted: true });
});
