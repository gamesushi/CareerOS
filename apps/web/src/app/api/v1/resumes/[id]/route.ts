import { z } from "zod";
import { prisma, Prisma } from "@careeros/db";
import { jsonResume } from "@careeros/shared";
import { handler, ok, parseBody, requireUser, ApiError } from "@/lib/api";

async function findOwned(userId: string, id: string) {
  const row = await prisma.resume.findFirst({ where: { id, userId, deletedAt: null } });
  if (!row) throw new ApiError(404, "not_found", "简历不存在");
  return row;
}

export const GET = handler(async (_req, { params }) => {
  const { userId } = await requireUser();
  const { id } = await params;
  const resume = await findOwned(userId, id);

  // 多语言版本家族：查找由该简历衍生、或同源派生的其它语言简历
  const rootId = resume.sourceResumeId ?? resume.id;
  const familyResumes = await prisma.resume.findMany({
    where: {
      userId,
      deletedAt: null,
      OR: [
        { id: rootId },
        { sourceResumeId: rootId },
      ],
    },
    select: { id: true, title: true, resumeType: true },
    orderBy: { generatedAt: "asc" },
  });

  // 生成 / 翻译状态：以最近一次 aiRun（resume_generate / translate）为准。
  // 任务在跑时显示「生成中」；失败显示「生成失败」+ 错误；空 resumeJson 且无 run 视为生成中（兜底）。
  const run = await prisma.aiRun.findFirst({
    where: { userId, kind: { in: ["resume_generate", "translate"] }, inputRef: { path: ["resumeId"], equals: id } },
    orderBy: { createdAt: "desc" },
  });
  let state: "ready" | "generating" | "failed" = "ready";
  let error: string | null = null;
  if (run && (run.status === "running" || run.status === "queued")) {
    state = "generating";
  } else if (run?.status === "failed") {
    state = "failed";
    error = run.error;
  } else if (!resume.resumeJson || Object.keys(resume.resumeJson as object).length === 0) {
    state = "generating";
  }
  return ok({ ...resume, state, error, familyResumes });
});

const updateInput = z.object({
  title: z.string().min(1).max(160).optional(),
  templateId: z.string().max(64).optional(),
  status: z.enum(["draft", "final", "archived"]).optional(),
  resumeJson: jsonResume.optional(),
});

export const PUT = handler(async (req, { params }) => {
  const { userId } = await requireUser();
  const { id } = await params;
  await findOwned(userId, id);
  const input = await parseBody(req, updateInput);
  const updated = await prisma.resume.update({
    where: { id },
    data: {
      title: input.title,
      templateId: input.templateId,
      status: input.status,
      ...(input.resumeJson ? { resumeJson: input.resumeJson as unknown as Prisma.InputJsonValue } : {}),
    },
  });
  return ok(updated);
});

export const DELETE = handler(async (_req, { params }) => {
  const { userId } = await requireUser();
  const { id } = await params;
  await findOwned(userId, id);
  await prisma.resume.update({ where: { id }, data: { deletedAt: new Date() } });
  return ok({ deleted: true });
});
