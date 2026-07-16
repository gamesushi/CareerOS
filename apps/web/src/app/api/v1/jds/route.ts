import { prisma } from "@careeros/db";
import { handler, ok, requireUser } from "@/lib/api";

export const GET = handler(async () => {
  const { userId } = await requireUser();
  const data = await prisma.jobDescription.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      company: true,
      title: true,
      status: true,
      sourceUrl: true,
      createdAt: true,
      matches: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { id: true, matchScore: true, createdAt: true },
      },
    },
  });
  return ok({
    data: data.map(({ matches, ...jd }) => ({ ...jd, latestMatch: matches[0] ?? null })),
  });
});
