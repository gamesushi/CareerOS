import { prisma } from "@careeros/db";
import { projectInput } from "@careeros/shared";
import { handler, ok, parseBody, requireUser, toDate, ApiError } from "@/lib/api";

export const GET = handler(async (req) => {
  const { userId } = await requireUser();
  const url = new URL(req.url);
  const experienceId = url.searchParams.get("experience_id");
  const data = await prisma.project.findMany({
    where: { userId, deletedAt: null, ...(experienceId ? { experienceId } : {}) },
    orderBy: [{ startDate: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }],
    include: {
      experience: { select: { id: true, company: true, title: true } },
      skills: { include: { skill: { select: { id: true, name: true } } } },
    },
  });
  return ok({ data });
});

export const POST = handler(async (req) => {
  const { userId } = await requireUser();
  const input = await parseBody(req, projectInput);

  if (input.experienceId) {
    const exp = await prisma.careerExperience.findFirst({
      where: { id: input.experienceId, userId, deletedAt: null },
    });
    if (!exp) throw new ApiError(400, "invalid_experience", "关联的工作经历不存在");
  }

  const created = await prisma.project.create({
    data: {
      userId,
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
  await prisma.careerProfile.updateMany({ where: { userId }, data: { isStale: true } });
  return ok(created, 201);
});
