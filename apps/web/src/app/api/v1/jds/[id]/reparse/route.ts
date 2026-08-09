import { prisma } from "@careeros/db";
import { handler, ok, requireUser, ApiError } from "@/lib/api";
import { aiQueue } from "@/lib/queue";

// 重新解析卡住的 JD：pending / parsing / failed 均可重入队。
// 用于「导入时 worker 未运行、jd_parse 任务丢失」的情况，避免 JD 永久卡在 pending。
export const POST = handler(async (_req, { params }) => {
  const { userId } = await requireUser();
  const { id } = await params;
  const jd = await prisma.jobDescription.findFirst({
    where: { id, userId },
    select: { id: true, status: true },
  });
  if (!jd) throw new ApiError(404, "not_found", "JD 不存在");
  if (jd.status === "parsed") {
    throw new ApiError(409, "already_parsed", "JD 已解析，无需重新解析");
  }

  await prisma.jobDescription.update({
    where: { id },
    data: { status: "pending" },
  });
  // jobId 加时间戳避免与 BullMQ 中已完成/失败的同名 job 冲突
  await aiQueue.add("jd_parse", { jdId: id }, { jobId: `jd-parse-${id}-${Date.now()}` });
  return ok({ retried: true, status: "pending" }, 202);
});
