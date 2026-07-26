import { prisma } from "@careeros/db";
import { jobWatchInput } from "@careeros/shared";
import { handler, ok, parseBody, requireUser } from "@/lib/api";

export const GET = handler(async () => {
  const { userId } = await requireUser();
  const data = await prisma.jobWatch.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { jobs: { where: { status: "new" } } } } },
  });
  return ok({
    data: data.map(({ _count, ...w }) => ({ ...w, newJobCount: _count.jobs })),
  });
});

export const POST = handler(async (req) => {
  const { userId } = await requireUser();
  const input = await parseBody(req, jobWatchInput);
  const created = await prisma.jobWatch.create({
    data: {
      userId,
      name: input.name,
      keywords: input.keywords,
      sources: input.sources,
      locations: input.locations,
      matchCategories: input.matchCategories,
      matchRoles: input.matchRoles,
      matchRegions: input.matchRegions,
      matchLanguages: input.matchLanguages,
      matchExperience: input.matchExperience,
      intervalMinutes: input.intervalMinutes,
      enabled: input.enabled,
    },
  });
  return ok(created, 201);
});
