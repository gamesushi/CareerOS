import { prisma } from "@careeros/db";
import { honorInput } from "@careeros/shared";
import { handler, ok, parseBody, requireUser, toDate } from "@/lib/api";

export const GET = handler(async () => {
  const { userId } = await requireUser();
  const data = await prisma.honor.findMany({
    where: { userId },
    orderBy: [{ date: { sort: "desc", nulls: "last" } }, { sortOrder: "asc" }],
  });
  return ok({ data });
});

export const POST = handler(async (req) => {
  const { userId } = await requireUser();
  const input = await parseBody(req, honorInput);
  const created = await prisma.honor.create({
    data: {
      userId,
      title: input.title,
      issuer: input.issuer,
      date: toDate(input.date),
      description: input.description,
      sortOrder: input.sortOrder,
    },
  });
  return ok(created, 201);
});
