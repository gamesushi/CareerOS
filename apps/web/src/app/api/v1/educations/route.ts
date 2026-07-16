import { prisma } from "@careeros/db";
import { educationInput } from "@careeros/shared";
import { handler, ok, parseBody, requireUser, toDate } from "@/lib/api";

export const GET = handler(async () => {
  const { userId } = await requireUser();
  const data = await prisma.education.findMany({
    where: { userId },
    orderBy: [{ startDate: { sort: "desc", nulls: "last" } }, { sortOrder: "asc" }],
  });
  return ok({ data });
});

export const POST = handler(async (req) => {
  const { userId } = await requireUser();
  const input = await parseBody(req, educationInput);
  const created = await prisma.education.create({
    data: {
      userId,
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
  return ok(created, 201);
});
