import { z } from "zod";
import { prisma } from "@careeros/db";
import { normalizeSkill } from "@careeros/shared";
import { handler, ok, parseBody, requireUser, ApiError } from "@/lib/api";

// SuggestionRow 一键采纳：技能（不存在则新建）挂 work_log_skills + skill_evidences，
// 项目挂 work_log_projects。这是"日志→技能证据"飞轮的写入点（docs/design/03 §5）。

const acceptInput = z.object({
  skills: z.array(z.object({ name: z.string().min(1).max(80), skillId: z.string().uuid().nullable() })).default([]),
  projectIds: z.array(z.string().uuid()).default([]),
});

export const POST = handler(async (req, { params }) => {
  const { userId } = await requireUser();
  const { id } = await params;
  const log = await prisma.workLog.findFirst({ where: { id, userId, deletedAt: null } });
  if (!log) throw new ApiError(404, "not_found", "日志不存在");

  const input = await parseBody(req, acceptInput);

  const result = await prisma.$transaction(async (tx) => {
    let evidenceCount = 0;

    for (const s of input.skills) {
      const nameNorm = normalizeSkill(s.name);
      const skill =
        (s.skillId ? await tx.skill.findFirst({ where: { id: s.skillId, userId } }) : null) ??
        (await tx.skill.upsert({
          where: { userId_nameNorm: { userId, nameNorm } },
          update: {},
          create: { userId, name: s.name, nameNorm, level: 0, levelSource: "ai" },
        }));

      await tx.workLogSkill.upsert({
        where: { workLogId_skillId: { workLogId: id, skillId: skill.id } },
        update: {},
        create: { workLogId: id, skillId: skill.id },
      });
      await tx.skillEvidence.upsert({
        where: { skillId_sourceType_sourceId: { skillId: skill.id, sourceType: "work_log", sourceId: id } },
        update: {},
        create: {
          skillId: skill.id,
          sourceType: "work_log",
          sourceId: id,
          note: `工作日志《${log.title}》`,
          weight: 1,
        },
      });
      await tx.skill.update({ where: { id: skill.id }, data: { lastUsedAt: log.logDate } });
      evidenceCount++;
    }

    for (const projectId of input.projectIds) {
      const project = await tx.project.findFirst({ where: { id: projectId, userId, deletedAt: null } });
      if (!project) continue;
      await tx.workLogProject.upsert({
        where: { workLogId_projectId: { workLogId: id, projectId } },
        update: {},
        create: { workLogId: id, projectId },
      });
    }

    // 清空建议（已消费）
    await tx.workLog.update({ where: { id }, data: { aiSuggestions: undefined } });
    return { evidenceCount, projects: input.projectIds.length };
  });

  return ok(result);
});
