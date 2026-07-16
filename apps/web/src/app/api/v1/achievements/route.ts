import { prisma } from "@careeros/db";
import { achievementInput } from "@careeros/shared";
import { handler, ok, parseBody, requireUser } from "@/lib/api";
import { toDate } from "@/lib/api";

export const GET = handler(async () => {
  const { userId } = await requireUser();
  const data = await prisma.achievement.findMany({
    where: { userId },
    orderBy: [{ occurredAt: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }],
    include: {
      experience: { select: { id: true, company: true, title: true } },
      project: { select: { id: true, name: true } },
    },
  });
  return ok({ data });
});

export const POST = handler(async (req) => {
  const { userId } = await requireUser();
  const input = await parseBody(req, achievementInput);
  const created = await prisma.achievement.create({
    data: {
      userId,
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
  return ok(created, 201);
});
