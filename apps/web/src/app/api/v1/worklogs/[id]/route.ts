import { prisma } from "@careeros/db";
import { workLogInput } from "@careeros/shared";
import { handler, ok, parseBody, requireUser, toDate, ApiError } from "@/lib/api";
import { aiQueue } from "@/lib/queue";

async function findOwned(userId: string, id: string) {
  const row = await prisma.workLog.findFirst({ where: { id, userId, deletedAt: null } });
  if (!row) throw new ApiError(404, "not_found", "日志不存在");
  return row;
}

export const GET = handler(async (_req, { params }) => {
  const { userId } = await requireUser();
  const { id } = await params;
  await findOwned(userId, id);
  const data = await prisma.workLog.findUnique({
    where: { id },
    include: {
      projects: { include: { project: { select: { id: true, name: true } } } },
      skills: { include: { skill: { select: { id: true, name: true } } } },
    },
  });
  return ok(data);
});

export const PUT = handler(async (req, { params }) => {
  const { userId } = await requireUser();
  const { id } = await params;
  const existing = await findOwned(userId, id);
  const input = await parseBody(req, workLogInput);

  const updated = await prisma.$transaction(async (tx) => {
    await tx.workLogProject.deleteMany({ where: { workLogId: id } });
    await tx.workLogSkill.deleteMany({ where: { workLogId: id } });
    return tx.workLog.update({
      where: { id },
      data: {
        logDate: toDate(input.logDate)!,
        title: input.title,
        content: input.content,
        tags: input.tags,
        projects: { create: input.projectIds.map((projectId) => ({ projectId })) },
        skills: { create: input.skillIds.map((skillId) => ({ skillId })) },
      },
    });
  });
  // 内容变化才重新摘要
  if (existing.content !== input.content || existing.title !== input.title) {
    await aiQueue.add("worklog_summarize", { workLogId: id }, { jobId: `wl-sum-${id}-${Date.now()}` });
  }
  return ok(updated);
});

export const DELETE = handler(async (_req, { params }) => {
  const { userId } = await requireUser();
  const { id } = await params;
  await findOwned(userId, id);
  await prisma.workLog.update({ where: { id }, data: { deletedAt: new Date() } });
  return ok({ deleted: true });
});
