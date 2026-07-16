import { prisma } from "@careeros/db";
import { handler, ok, requireUser, ApiError } from "@/lib/api";

export const GET = handler(async (_req, { params }) => {
  const { userId } = await requireUser();
  const { id } = await params;
  const jd = await prisma.jobDescription.findFirst({
    where: { id, userId },
    include: {
      matches: {
        orderBy: { createdAt: "desc" },
        select: { id: true, matchScore: true, createdAt: true, runId: true },
      },
    },
  });
  if (!jd) throw new ApiError(404, "not_found", "JD 不存在");
  return ok(jd);
});

export const DELETE = handler(async (_req, { params }) => {
  const { userId } = await requireUser();
  const { id } = await params;
  const jd = await prisma.jobDescription.findFirst({ where: { id, userId } });
  if (!jd) throw new ApiError(404, "not_found", "JD 不存在");
  await prisma.jobDescription.delete({ where: { id } });
  return ok({ deleted: true });
});
