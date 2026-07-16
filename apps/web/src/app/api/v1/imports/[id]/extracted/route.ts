import { prisma } from "@careeros/db";
import { handler, ok, requireUser, ApiError } from "@/lib/api";

export const GET = handler(async (_req, { params }) => {
  const { userId } = await requireUser();
  const { id } = await params;
  const imp = await prisma.resumeImport.findFirst({
    where: { id, userId },
    select: { status: true, extracted: true, rawText: true, fileName: true },
  });
  if (!imp) throw new ApiError(404, "not_found", "导入记录不存在");
  if (imp.status !== "review" || !imp.extracted) {
    throw new ApiError(409, "not_ready", `当前状态为 ${imp.status}，抽取结果尚未就绪`);
  }
  return ok({ fileName: imp.fileName, rawText: imp.rawText, extracted: imp.extracted });
});
