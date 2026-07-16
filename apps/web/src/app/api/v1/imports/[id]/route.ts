import { prisma } from "@careeros/db";
import { handler, ok, requireUser, ApiError } from "@/lib/api";

export const GET = handler(async (_req, { params }) => {
  const { userId } = await requireUser();
  const { id } = await params;
  const imp = await prisma.resumeImport.findFirst({
    where: { id, userId },
    select: {
      id: true,
      fileName: true,
      status: true,
      error: true,
      rawText: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  if (!imp) throw new ApiError(404, "not_found", "导入记录不存在");
  return ok(imp);
});
