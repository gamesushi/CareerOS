import { prisma } from "@careeros/db";
import { experienceInput, normalizeCompany } from "@careeros/shared";
import { handler, ok, parseBody, requireUser, toDate } from "@/lib/api";

export const GET = handler(async () => {
  const { userId } = await requireUser();
  const data = await prisma.careerExperience.findMany({
    where: { userId, deletedAt: null },
    orderBy: { startDate: "desc" },
    include: {
      projects: { where: { deletedAt: null }, select: { id: true, name: true } },
      achievements: { select: { id: true, title: true } },
    },
  });
  return ok({ data });
});

export const POST = handler(async (req) => {
  const { userId } = await requireUser();
  const input = await parseBody(req, experienceInput);
  const created = await prisma.careerExperience.create({
    data: {
      userId,
      company: input.company,
      companyNorm: normalizeCompany(input.company),
      title: input.title,
      employmentType: input.employmentType,
      startDate: toDate(input.startDate)!,
      endDate: toDate(input.endDate),
      location: input.location,
      description: input.description,
      highlights: input.highlights,
      lang: input.lang,
      sortOrder: input.sortOrder,
    },
  });
  await prisma.careerProfile.updateMany({ where: { userId }, data: { isStale: true } });
  return ok(created, 201);
});
