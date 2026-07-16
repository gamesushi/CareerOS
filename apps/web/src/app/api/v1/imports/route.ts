import { prisma } from "@careeros/db";
import { handler, ok, requireUser } from "@/lib/api";

export const GET = handler(async () => {
  const { userId } = await requireUser();
  const data = await prisma.resumeImport.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      fileName: true,
      status: true,
      error: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  return ok({ data });
});
