import { z } from "zod";
import { prisma, Prisma } from "@careeros/db";
import { normalizeSkill } from "@careeros/shared";
import { chat } from "../ai/provider";
import { startRun, finishRun } from "../ai/audit";

// 日志保存后自动执行：1-2 句摘要 + 建议技能/项目关联。
// 建议只落 ai_suggestions，用户在 SuggestionRow 一键采纳后才写关联与证据（飞轮的人工确认点）。

export const PROMPT_VERSION = "worklog-summarize-v1";

const outputSchema = z.object({
  summary: z.string().max(300),
  suggestedSkills: z.array(z.string().max(80)).default([]),
  suggestedProjects: z.array(z.string().max(160)).default([]),
});

const SYSTEM_PROMPT = `你是职业工作日志助手。对一篇工作日志：
1. 生成 1-2 句客观摘要（summary，保留原文语言，不夸大）。
2. 识别日志体现的专业技能（suggestedSkills）：优先从"已有技能表"中选择匹配项（用表中原名），确实是新技能才给新名称；最多 5 个。
3. 若日志内容明显属于"项目列表"中的某个项目，在 suggestedProjects 给出该项目原名；不确定则空数组。

输出 JSON：{ "summary": string, "suggestedSkills": string[], "suggestedProjects": string[] }`;

export async function handleWorklogSummarizeJob(workLogId: string): Promise<void> {
  const log = await prisma.workLog.findUnique({ where: { id: workLogId } });
  if (!log || log.deletedAt) return;

  const [skills, projects] = await Promise.all([
    prisma.skill.findMany({ where: { userId: log.userId }, select: { id: true, name: true, nameNorm: true } }),
    prisma.project.findMany({ where: { userId: log.userId, deletedAt: null }, select: { id: true, name: true } }),
  ]);

  const run = await startRun({
    userId: log.userId,
    kind: "worklog_summarize",
    inputRef: { workLogId },
    promptVersion: PROMPT_VERSION,
  });
  const t0 = Date.now();

  try {
    const res = await chat({
      system: SYSTEM_PROMPT,
      user: `已有技能表：${skills.map((s) => s.name).join("、") || "（空）"}
项目列表：${projects.map((p) => p.name).join("、") || "（空）"}

工作日志（${log.logDate.toISOString().slice(0, 10)}）《${log.title}》：
${log.content.slice(0, 8000)}`,
      json: true,
    });

    const parsed = outputSchema.safeParse(JSON.parse(res.content));
    if (!parsed.success) throw new Error(`摘要输出校验失败: ${parsed.error.message.slice(0, 200)}`);
    const out = parsed.data;

    // 建议对齐到已有实体 id（有 id = 采纳时直接关联；无 id = 采纳时新建技能）
    const skillByNorm = new Map(skills.map((s) => [s.nameNorm, s]));
    const projectByName = new Map(projects.map((p) => [p.name, p]));
    const suggestions = {
      skills: out.suggestedSkills.map((name) => ({
        name,
        skillId: skillByNorm.get(normalizeSkill(name))?.id ?? null,
      })),
      projects: out.suggestedProjects
        .map((name) => ({ name, projectId: projectByName.get(name)?.id ?? null }))
        .filter((p) => p.projectId), // 项目只建议已存在的，避免噪音
    };

    await prisma.workLog.update({
      where: { id: workLogId },
      data: { aiSummary: out.summary, aiSuggestions: suggestions as Prisma.InputJsonValue },
    });
    await finishRun(run.id, {
      ok: true, model: res.model, tokensIn: res.tokensIn, tokensOut: res.tokensOut, latencyMs: Date.now() - t0,
    });
  } catch (e) {
    await finishRun(run.id, { ok: false, error: String(e), latencyMs: Date.now() - t0 });
    throw e;
  }
}
