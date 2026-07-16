import { prisma } from "@careeros/db";
import { handler, ok, requireUser } from "@/lib/api";

export const GET = handler(async () => {
  const { userId } = await requireUser();
  const profile = await prisma.careerProfile.findUnique({ where: { userId } });
  return ok(profile ?? { isStale: true, headline: null, summary: null, careerTags: [], industryTags: [] });
});
