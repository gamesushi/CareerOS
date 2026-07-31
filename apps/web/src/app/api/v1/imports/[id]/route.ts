import { prisma } from "@careeros/db";
import { handler, ok, requireUser, ApiError } from "@/lib/api";
import { deleteObject } from "@/lib/s3";

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

export const DELETE = handler(async (_req, { params }) => {
  const { userId } = await requireUser();
  const { id } = await params;
  const imp = await prisma.resumeImport.findFirst({
    where: { id, userId },
    select: { id: true, fileKey: true, status: true },
  });
  if (!imp) throw new ApiError(404, "not_found", "导入记录不存在");
  // 关联的经历/项目为 onDelete: SetNull，直接删记录即可安全解绑
  await prisma.resumeImport.delete({ where: { id } });
  // 清理 MinIO 上的源文件（best-effort，失败不影响记录删除）
  try {
    await deleteObject(imp.fileKey);
  } catch {
    /* ignore S3 cleanup errors */
  }
  return ok({ deleted: true });
});

