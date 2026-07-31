import { z } from "zod";
import { prisma } from "@careeros/db";
import { handler, ok, parseBody, requireUser, ApiError } from "@/lib/api";
import { chat } from "@/lib/ai";
import { startAiRun, finishAiRun, aiRateLimited } from "@/lib/ai-log";

export const runtime = "nodejs";

const DOC_TYPES = ["cover_letter", "thank_you", "follow_up"] as const;
const LANGS = ["zh", "en", "ja"] as const;
const TONES = ["formal", "warm", "concise"] as const;

const bodySchema = z.object({
  docType: z.enum(DOC_TYPES),
  language: z.enum(LANGS).default("zh"),
  tone: z.enum(TONES).default("formal"),
  context: z.string().max(6000).optional(), // JD / 岗位 / 公司背景
  points: z.string().max(2000).optional(), // 补充要点
});

const DOC_LABEL: Record<string, string> = { cover_letter: "求职信（Cover Letter）", thank_you: "面试感谢信", follow_up: "跟进邮件" };
const LANG_LABEL: Record<string, string> = { zh: "简体中文", en: "English", ja: "日本語" };
const TONE_LABEL: Record<string, string> = { formal: "正式、专业", warm: "热情、真诚", concise: "简洁、直接" };

function guidance(docType: string): string {
  switch (docType) {
    case "cover_letter":
      return "开头点明应聘的岗位与最契合的 1 个匹配点；中间用 1-2 段具体经历/成果佐证；结尾表达加入意愿并礼貌收束。";
    case "thank_you":
      return "感谢面试官的时间；简述面试中让你更感兴趣或印象深刻的点；重申你与岗位的匹配与意愿。控制在简短一封。";
    case "follow_up":
      return "礼貌询问招聘进展；用一两句重申你的价值与匹配；给出明确、低压力的下一步。控制在简短一封。";
    default:
      return "";
  }
}

export const POST = handler(async (req) => {
  const { userId } = await requireUser();
  const input = await parseBody(req, bodySchema);

  const [user, profile, exps, skills] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { name: true } }),
    prisma.careerProfile.findUnique({ where: { userId }, select: { headline: true, summary: true } }),
    prisma.careerExperience.findMany({
      where: { userId, deletedAt: null },
      orderBy: { startDate: "desc" },
      take: 3,
      select: { company: true, title: true },
    }),
    prisma.skill.findMany({ where: { userId }, orderBy: { level: "desc" }, take: 12, select: { name: true } }),
  ]);

  const bg =
    [
      user?.name ? `姓名：${user.name}` : "",
      profile?.headline ? `头衔：${profile.headline}` : "",
      profile?.summary ? `简介：${profile.summary}` : "",
      exps.length ? `近期经历：${exps.map((e) => `${e.company}·${e.title}`).join("；")}` : "",
      skills.length ? `技能：${skills.map((s) => s.name).join("、")}` : "",
    ]
      .filter(Boolean)
      .join("\n") || "（候选人尚未完善职业档案，请写得通用一些）";

  const system = `你是资深求职文书写手。请为候选人撰写一封${DOC_LABEL[input.docType]}。
要求：
- 语言：用${LANG_LABEL[input.language]}书写。
- 语气：${TONE_LABEL[input.tone]}。
- 只基于给定的候选人背景，绝不编造未提供的经历、公司、数字或头衔。
- ${guidance(input.docType)}
- 直接输出可用的文书正文，不要额外解释、不要用 markdown 代码块或标题包裹。`;

  const userMsg = `【候选人背景】\n${bg}\n\n【目标岗位/公司背景】\n${input.context?.trim() || "（未提供，请写得通用一些）"}\n\n【补充要点/强调】\n${input.points?.trim() || "（无）"}`;

  if (await aiRateLimited(userId, "writing", 8, 60)) {
    throw new ApiError(429, "rate_limited", "生成过于频繁，请稍后再试");
  }
  const runId = await startAiRun(userId, "writing");
  const t0 = Date.now();
  try {
    const res = await chat({ system, user: userMsg, temperature: 0.7, model: "deepseek-v4-flash" });
    await finishAiRun(runId, { status: "succeeded", model: res.model, tokensIn: res.tokensIn, tokensOut: res.tokensOut, latencyMs: Date.now() - t0 });
    return ok({ data: { content: res.content, model: res.model } });
  } catch (e) {
    await finishAiRun(runId, { status: "failed", latencyMs: Date.now() - t0, error: String(e) });
    throw new ApiError(502, "ai_error", `生成失败：${e instanceof Error ? e.message : String(e)}`);
  }
});
