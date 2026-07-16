import { prisma } from "@careeros/db";
import { achievementInput } from "@careeros/shared";
import { handler, ok, parseBody, requireUser, toDate, ApiError } from "@/lib/api";

async function findOwned(userId: string, id: string) {
  const row = await prisma.achievement.findFirst({ where: { id, userId } });
  if (!row) throw new ApiError(404, "not_found", "成果不存在");
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
  const input = await parseBody(req, achievementInput);
  const updated = await prisma.achievement.update({
    where: { id },
    data: {
      title: input.title,
      metricValue: input.metricValue,
      metricUnit: input.metricUnit,
      metricText: input.metricText,
      evidence: input.evidence,
      experienceId: input.experienceId ?? null,
      projectId: input.projectId ?? null,
      occurredAt: toDate(input.occurredAt),
    },
  });
  return ok(updated);
});

export const DELETE = handler(async (_req, { params }) => {
  const { userId } = await requireUser();
  const { id } = await params;
  await findOwned(userId, id);
  await prisma.achievement.delete({ where: { id } });
  return ok({ deleted: true });
});
