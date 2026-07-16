import { prisma } from "@careeros/db";
import { workLogInput } from "@careeros/shared";
import { handler, ok, parseBody, requireUser, toDate } from "@/lib/api";
import { aiQueue } from "@/lib/queue";

export const GET = handler(async (req) => {
  const { userId } = await requireUser();
  const url = new URL(req.url);
  const tag = url.searchParams.get("tag");
  const projectId = url.searchParams.get("project_id");
  const q = url.searchParams.get("q");

  const data = await prisma.workLog.findMany({
    where: {
      userId,
      deletedAt: null,
      ...(tag ? { tags: { has: tag } } : {}),
      ...(projectId ? { projects: { some: { projectId } } } : {}),
      ...(q ? { OR: [{ title: { contains: q, mode: "insensitive" } }, { content: { contains: q, mode: "insensitive" } }] } : {}),
    },
    orderBy: [{ logDate: "desc" }, { createdAt: "desc" }],
    take: 100,
    include: {
      projects: { include: { project: { select: { id: true, name: true } } } },
      skills: { include: { skill: { select: { id: true, name: true } } } },
    },
  });
  return ok({ data });
});

export const POST = handler(async (req) => {
  const { userId } = await requireUser();
  const input = await parseBody(req, workLogInput);
  const created = await prisma.workLog.create({
    data: {
      userId,
      logDate: toDate(input.logDate)!,
      title: input.title,
      content: input.content,
      tags: input.tags,
      projects: { create: input.projectIds.map((projectId) => ({ projectId })) },
      skills: { create: input.skillIds.map((skillId) => ({ skillId })) },
    },
    include: {
      projects: { include: { project: { select: { id: true, name: true } } } },
      skills: { include: { skill: { select: { id: true, name: true } } } },
    },
  });
  // 保存即触发 AI 摘要 + 关联建议（异步，完成后卡片自动出现摘要）
  await aiQueue.add("worklog_summarize", { workLogId: created.id }, { jobId: `wl-sum-${created.id}-${Date.now()}` });
  return ok(created, 201);
});
