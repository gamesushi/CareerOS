import { prisma } from "@careeros/db";
import { handler, ok, requireUser, ApiError } from "@/lib/api";
import { aiQueue } from "@/lib/queue";

/** 重试失败的导入：重置状态并重新入队解析任务（源文件仍在 S3，无需重传）。 */
export const POST = handler(async (_req, { params }) => {
  const { userId } = await requireUser();
  const { id } = await params;
  const imp = await prisma.resumeImport.findFirst({
    where: { id, userId },
    select: { id: true, status: true },
  });
  if (!imp) throw new ApiError(404, "not_found", "导入记录不存在");
  if (imp.status !== "failed") {
    throw new ApiError(409, "not_retryable", "仅失败的导入可以重试");
  }

  await prisma.resumeImport.update({
    where: { id },
    data: { status: "pending", error: null },
  });
  // jobId 加时间戳避免与 BullMQ 中已完成/失败的同名 job 冲突
  await aiQueue.add("resume_parse", { importId: id }, { jobId: `resume-parse-${id}-${Date.now()}` });
  return ok({ retried: true, status: "pending" }, 202);
});
