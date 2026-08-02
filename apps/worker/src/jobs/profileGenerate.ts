import { z } from "zod";
import { prisma } from "@careeros/db";
import { chat } from "../ai/provider";
import { startRun, finishRun } from "../ai/audit";
import { localeToLanguage } from "../ai/language";

// 职业画像生成：从全部实体摘要出 headline/summary/tags/level/years/industry。
// 实体变更会把 is_stale 置 true，用户在 Dashboard 点"重新生成"触发本任务。

export const PROMPT_VERSION = "profile-generate-v1";

const outputSchema = z.object({
  headline: z.string().max(128),
  summary: z.string().max(2000),
  careerTags: z.array(z.string().max(32)).max(8).default([]),
  careerLevel: z.enum(["junior", "mid", "senior", "staff", "exec"]),
  yearsExperience: z.number().min(0).max(60),
  industryTags: z.array(z.string().max(64)).max(6).default([]),
});

const SYSTEM_PROMPT = `你是职业画像分析师。基于用户职业数据库的完整摘要，生成客观的职业画像。

重要：用户主语言为 {LANG}。所有输出字段（headline / summary / careerTags / industryTags）必须使用 {LANG} 撰写；若职业数据库中的原文为其他语言，请翻译为 {LANG}。

规则：
1. headline：一句话职业定位（如"资深后端工程师"），基于最突出、最近的经历，不夸大。
2. summary：3-5 句职业综述，突出行业积累、核心能力与量化成果。
3. careerTags：3-8 个职业标签。careerLevel：junior/mid/senior/staff/exec。
4. yearsExperience：从最早工作经历起算的年数（数字，可带一位小数）。
5. industryTags：所处行业标签。

输出 JSON：{ "headline": string, "summary": string, "careerTags": string[], "careerLevel": string, "yearsExperience": number, "industryTags": string[] }`;

export async function handleProfileGenerateJob(userId: string): Promise<void> {
  const [userRec, experiences, projects, skills, achievements, logCount] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { locale: true } }),
    prisma.careerExperience.findMany({ where: { userId, deletedAt: null }, orderBy: { startDate: "asc" } }),
    prisma.project.findMany({ where: { userId, deletedAt: null } }),
    prisma.skill.findMany({ where: { userId }, orderBy: { level: "desc" } }),
    prisma.achievement.findMany({ where: { userId } }),
    prisma.workLog.count({ where: { userId, deletedAt: null } }),
  ]);
  if (experiences.length === 0 && projects.length === 0) {
    throw new Error("职业数据不足（无经历与项目），先补充数据再生成画像");
  }
  const lang = localeToLanguage(userRec?.locale);

  const digest = [
    "## 工作经历",
    ...experiences.map(
      (e) =>
        `- ${e.company} ${e.title}（${e.startDate.toISOString().slice(0, 7)} ~ ${e.endDate?.toISOString().slice(0, 7) ?? "至今"}）${e.highlights.join("；")}`,
    ),
    "## 项目",
    ...projects.map((p) => `- ${p.name}${p.role ? `（${p.role}）` : ""} ${p.outcome ?? p.description ?? ""}`),
    "## 技能",
    skills.map((s) => `${s.name}(${s.level})`).join("、"),
    "## 成果",
    ...achievements.map((a) => `- ${a.title} ${a.metricValue ?? ""}${a.metricUnit ?? ""}${a.metricText ?? ""}`),
    `## 工作日志累计 ${logCount} 篇`,
  ].join("\n");

  const run = await startRun({ userId, kind: "profile_generate", inputRef: {}, promptVersion: PROMPT_VERSION });
  const t0 = Date.now();

  try {
    const res = await chat({ system: SYSTEM_PROMPT.replace("{LANG}", lang.label), user: digest.slice(0, 15_000), json: true });
    const parsed = outputSchema.safeParse(JSON.parse(res.content));
    if (!parsed.success) throw new Error(`画像输出校验失败: ${parsed.error.message.slice(0, 200)}`);
    const out = parsed.data;

    await prisma.careerProfile.upsert({
      where: { userId },
      update: {
        headline: out.headline,
        summary: out.summary,
        careerTags: out.careerTags,
        careerLevel: out.careerLevel,
        yearsExperience: out.yearsExperience,
        industryTags: out.industryTags,
        isStale: false,
        generatedRunId: run.id,
      },
      create: {
        userId,
        headline: out.headline,
        summary: out.summary,
        careerTags: out.careerTags,
        careerLevel: out.careerLevel,
        yearsExperience: out.yearsExperience,
        industryTags: out.industryTags,
        isStale: false,
        generatedRunId: run.id,
      },
    });
    await finishRun(run.id, {
      ok: true, model: res.model, tokensIn: res.tokensIn, tokensOut: res.tokensOut, latencyMs: Date.now() - t0,
    });
  } catch (e) {
    await finishRun(run.id, { ok: false, error: String(e), latencyMs: Date.now() - t0 });
    throw e;
  }
}
