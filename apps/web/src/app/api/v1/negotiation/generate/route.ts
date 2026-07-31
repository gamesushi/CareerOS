import { z } from "zod";
import { prisma } from "@careeros/db";
import { handler, ok, parseBody, requireUser, ApiError } from "@/lib/api";
import { chat } from "@/lib/ai";
import { startAiRun, finishAiRun, aiRateLimited } from "@/lib/ai-log";

export const runtime = "nodejs";

const PRIORITIES = ["base", "annual", "signon", "equity", "start", "level", "location"] as const;
const PRIORITY_LABEL: Record<string, string> = {
  base: "基本工资（月薪×薪数）",
  annual: "年终 / 绩效奖金",
  signon: "签字费 / sign-on",
  equity: "股票 / 期权",
  start: "到岗时间",
  level: "职级 / title",
  location: "地点 / 远程",
};

const bodySchema = z.object({
  role: z.string().min(1).max(160),
  company: z.string().max(128).optional(),
  offer: z.string().max(3000).optional(), // 当前 offer 详情
  competing: z.string().max(1500).optional(), // 竞争 offer / 筹码
  priorities: z.array(z.enum(PRIORITIES)).max(7).default([]),
  language: z.enum(["zh", "en"]).default("zh"),
});

export const POST = handler(async (req) => {
  const { userId } = await requireUser();
  const input = await parseBody(req, bodySchema);

  const [user, profile, exps] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { name: true, preferredCity: true } }),
    prisma.careerProfile.findUnique({ where: { userId }, select: { headline: true, careerLevel: true, yearsExperience: true } }),
    prisma.careerExperience.findMany({
      where: { userId, deletedAt: null },
      orderBy: { startDate: "desc" },
      take: 2,
      select: { company: true, title: true },
    }),
  ]);

  const bg =
    [
      profile?.headline ? `头衔：${profile.headline}` : "",
      profile?.yearsExperience ? `经验：约 ${profile.yearsExperience} 年` : "",
      profile?.careerLevel ? `层级：${profile.careerLevel}` : "",
      exps.length ? `近期经历：${exps.map((e) => `${e.company}·${e.title}`).join("；")}` : "",
      user?.preferredCity ? `意向城市：${user.preferredCity}` : "",
    ]
      .filter(Boolean)
      .join("\n") || "（候选人档案信息有限）";

  const prios = input.priorities.length ? input.priorities.map((p) => PRIORITY_LABEL[p]).join("、") : "（未指定，按常见优先级）";

  const system = `你是一位面向中国就业市场的资深薪酬谈判顾问。请为候选人生成一份**谈薪剧本（negotiation playbook）**。

本地化要求（务必贴合中国市场，勿套用美国式）：
- 薪酬结构以「基本月薪 × 薪数（如 15/16 薪）+ 年终/绩效奖金」为主；股票/期权权重相对低（互联网大厂/外企才显著），不要默认按美式 RSU/equity 为核心。
- 覆盖维度可含：基本工资与薪数、年终/绩效、签字费(sign-on)、股票/期权、到岗时间、职级/title、地点/远程、补贴（住房/交通/餐补）。
- 语气专业、可执行，给**具体话术示例**而非空泛原则。

输出结构（用${input.language === "en" ? "English" : "简体中文"}，纯文本或简单编号，不要 markdown 代码块）：
1. 整体策略（1 段：锚定、让步顺序、BATNA/替代方案思路）
2. 分维度建议：对每个相关维度给「争取空间判断 + 一句可直接说的话术」
3. 注意事项 / 避坑（3-5 条，如勿过早报底价、书面确认、别只盯 base）

只基于用户提供的信息，不要编造具体数字；若信息不足，给出「先问清 X」的建议。`;

  const userMsg = `【候选人背景】\n${bg}\n\n【目标岗位】\n${input.role}${input.company ? ` @ ${input.company}` : ""}\n\n【当前 offer 情况】\n${input.offer?.trim() || "（尚未拿到具体 offer / 未提供）"}\n\n【竞争 offer / 筹码】\n${input.competing?.trim() || "（无 / 未提供）"}\n\n【最看重的维度】\n${prios}`;

  if (await aiRateLimited(userId, "negotiation", 8, 60)) {
    throw new ApiError(429, "rate_limited", "生成过于频繁，请稍后再试");
  }
  const runId = await startAiRun(userId, "negotiation");
  const t0 = Date.now();
  try {
    const res = await chat({ system, user: userMsg, temperature: 0.6, model: "deepseek-v4-flash" });
    await finishAiRun(runId, { status: "succeeded", model: res.model, tokensIn: res.tokensIn, tokensOut: res.tokensOut, latencyMs: Date.now() - t0 });
    return ok({ data: { content: res.content, model: res.model } });
  } catch (e) {
    await finishAiRun(runId, { status: "failed", latencyMs: Date.now() - t0, error: String(e) });
    throw new ApiError(502, "ai_error", `生成失败：${e instanceof Error ? e.message : String(e)}`);
  }
});
