import { prisma } from "@careeros/db";
import { handler, ok, requireUser } from "@/lib/api";

export const GET = handler(async () => {
  const { userId } = await requireUser();
  const data = await prisma.resume.findMany({
    where: { userId, deletedAt: null },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      title: true,
      resumeType: true,
      version: true,
      templateId: true,
      status: true,
      jdId: true,
      generatedAt: true,
      updatedAt: true,
      jd: { select: { company: true, title: true } },
    },
  });
  return ok({ data });
});
