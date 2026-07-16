import { randomUUID } from "node:crypto";
import { prisma } from "@careeros/db";
import { handler, ok, requireUser, ApiError } from "@/lib/api";
import { putObject } from "@/lib/s3";
import { aiQueue } from "@/lib/queue";

const ALLOWED_EXT = ["pdf", "docx", "doc", "md", "txt"];
const MAX_SIZE = 15 * 1024 * 1024;

export const POST = handler(async (req) => {
  const { userId } = await requireUser();

  const form = await req.formData().catch(() => {
    throw new ApiError(400, "invalid_form", "请求必须是 multipart/form-data");
  });
  const file = form.get("file");
  if (!(file instanceof File)) throw new ApiError(400, "missing_file", "缺少 file 字段");

  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (!ALLOWED_EXT.includes(ext)) {
    throw new ApiError(400, "unsupported_type", `不支持的文件类型 .${ext}，支持：${ALLOWED_EXT.join("/")}`);
  }
  if (file.size > MAX_SIZE) throw new ApiError(400, "too_large", "文件不能超过 15MB");
  if (file.size === 0) throw new ApiError(400, "empty_file", "文件为空");

  const buffer = Buffer.from(await file.arrayBuffer());
  const fileKey = `imports/${userId}/${randomUUID()}.${ext}`;
  await putObject(fileKey, buffer, file.type || "application/octet-stream");

  const imp = await prisma.resumeImport.create({
    data: {
      userId,
      fileKey,
      fileName: file.name,
      mimeType: file.type || `application/${ext}`,
      status: "pending",
    },
  });

  await aiQueue.add("resume_parse", { importId: imp.id }, { jobId: `resume-parse-${imp.id}` });
  return ok({ importId: imp.id, status: imp.status }, 202);
});
