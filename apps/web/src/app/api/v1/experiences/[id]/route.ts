import { prisma } from "@careeros/db";
import { experienceInput, normalizeCompany } from "@careeros/shared";
import { handler, ok, parseBody, requireUser, toDate, ApiError } from "@/lib/api";

async function findOwned(userId: string, id: string) {
  const row = await prisma.careerExperience.findFirst({ where: { id, userId, deletedAt: null } });
  if (!row) throw new ApiError(404, "not_found", "工作经历不存在");
  return row;
}

export const GET = handler(async (_req, { params }) => {
  const { userId } = await requireUser();
  const { id } = await params;
  await findOwned(userId, id);
  const data = await prisma.careerExperience.findUnique({
    where: { id },
    include: {
      projects: { where: { deletedAt: null } },
      achievements: true,
    },
  });
  return ok(data);
});

export const PUT = handler(async (req, { params }) => {
  const { userId } = await requireUser();
  const { id } = await params;
  await findOwned(userId, id);
  const input = await parseBody(req, experienceInput);
  const updated = await prisma.careerExperience.update({
    where: { id },
    data: {
      company: input.company,
      companyNorm: normalizeCompany(input.company),
      department: input.department,
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
  return ok(updated);
});

export const DELETE = handler(async (_req, { params }) => {
  const { userId } = await requireUser();
  const { id } = await params;
  await findOwned(userId, id);
  await prisma.careerExperience.update({ where: { id }, data: { deletedAt: new Date() } });
  return ok({ deleted: true });
});
