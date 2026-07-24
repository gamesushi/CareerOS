import { prisma } from "@careeros/db";
import { honorInput } from "@careeros/shared";
import { handler, ok, parseBody, requireUser, toDate, ApiError } from "@/lib/api";

async function findOwned(userId: string, id: string) {
  const row = await prisma.honor.findFirst({ where: { id, userId } });
  if (!row) throw new ApiError(404, "not_found", "荣誉不存在");
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
  const input = await parseBody(req, honorInput);
  const updated = await prisma.honor.update({
    where: { id },
    data: {
      title: input.title,
      issuer: input.issuer,
      date: toDate(input.date),
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
  await prisma.honor.delete({ where: { id } });
  return ok({ deleted: true });
});
