import { prisma } from "@careeros/db";
import { jobWatchInput } from "@careeros/shared";
import { handler, ok, parseBody, requireUser, ApiError } from "@/lib/api";

async function findOwned(userId: string, id: string) {
  const row = await prisma.jobWatch.findFirst({ where: { id, userId } });
  if (!row) throw new ApiError(404, "not_found", "监测任务不存在");
  return row;
}

export const PUT = handler(async (req, { params }) => {
  const { userId } = await requireUser();
  const { id } = await params;
  await findOwned(userId, id);
  const input = await parseBody(req, jobWatchInput.partial());
  const updated = await prisma.jobWatch.update({ where: { id }, data: input });
  return ok(updated);
});

export const DELETE = handler(async (_req, { params }) => {
  const { userId } = await requireUser();
  const { id } = await params;
  await findOwned(userId, id);
  await prisma.jobWatch.delete({ where: { id } });
  return ok({ deleted: true });
});
