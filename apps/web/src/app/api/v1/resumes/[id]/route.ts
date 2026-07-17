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

  // 生成状态：resumeJson 为空时查最近一次 resume_generate run
  const empty = !resume.resumeJson || Object.keys(resume.resumeJson as object).length === 0;
  let state: "ready" | "generating" | "failed" = empty ? "generating" : "ready";
  let error: string | null = null;
  if (empty) {
    const run = await prisma.aiRun.findFirst({
      where: { userId, kind: "resume_generate", inputRef: { path: ["resumeId"], equals: id } },
      orderBy: { createdAt: "desc" },
    });
    if (run?.status === "failed") {
      state = "failed";
      error = run.error;
    }
  }
  return ok({ ...resume, state, error });
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
