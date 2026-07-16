import { prisma } from "@careeros/db";
import { educationInput } from "@careeros/shared";
import { handler, ok, parseBody, requireUser, toDate, ApiError } from "@/lib/api";

async function findOwned(userId: string, id: string) {
  const row = await prisma.education.findFirst({ where: { id, userId } });
  if (!row) throw new ApiError(404, "not_found", "教育经历不存在");
  return row;
}

export const GET = handler(async (_req, { params }) => {
  const { userId } = await requireUser();
  const { id } = await params;
  return ok(await findOwned(userId, id));
});

export const PUT = handler(async (req, { params }) => {
  const { userId } = await requireUser();
  const { id } = await params;
  await findOwned(userId, id);
  const input = await parseBody(req, educationInput);
  const updated = await prisma.education.update({
    where: { id },
    data: {
      school: input.school,
      degree: input.degree,
      major: input.major,
      startDate: toDate(input.startDate),
      endDate: toDate(input.endDate),
      gpa: input.gpa,
      description: input.description,
      sortOrder: input.sortOrder,
    },
  });
  return ok(updated);
});

export const DELETE = handler(async (_req, { params }) => {
  const { userId } = await requireUser();
  const { id } = await params;
  await findOwned(userId, id);
  await prisma.education.delete({ where: { id } });
  return ok({ deleted: true });
});
