import { prisma, Prisma } from "@careeros/db";
import { jsonResume, type JsonResume } from "@careeros/shared";
import { chat } from "../ai/provider";
import { startRun, finishRun } from "../ai/audit";

// 简历生成（docs/design/04 §3）：
// FactPack（实体事实包）→ LLM 选材+措辞 → zod 校验 → 事实包含性校验（x-warnings）→ 写快照。
// 防幻觉硬约束：只允许使用 FactPack 中的事实；生成后对数字做包含性检查。

export const PROMPT_VERSION = "resume-generate-v1";

const SYSTEM_PROMPT = `你是简历撰写专家。基于「事实包」生成一份 JSON Resume。

硬性规则：
1. 只能使用事实包中的信息。可以改写措辞、精简、bullet 化，禁止新增数字、公司、职位、技能或成果。
2. 若提供了 JD，按相关度选材排序：最相关的经历/项目在前。禁止完全省略所有项目经历：当项目总数 ≤3 时全部保留；当项目总数 >3 时至少保留 2 个与 JD 最相关的项目。不提供 JD 则全量收录按时间倒序。
3. highlights 每条以动词开头、含量化结果（仅当事实包中有该数字）。
4. summary 3-4 句，突出与目标岗位的匹配点。
5. 目标语言：{LANG}。若与事实包语言不同，专业地道地翻译（不逐字直译）。
6. 日期格式 YYYY-MM。当前在职的 endDate 留空。
{EXTRA}
输出 JSON（严格遵守）：
{ "basics": {"name","label","email","phone","location","summary"},
  "work": [{"name","position","startDate","endDate","location","summary","highlights":[]}],
  "projects": [{"name","description","highlights":[],"keywords":[],"roles":[],"startDate","endDate"}],
  "skills": [{"name","level","keywords":[]}],
  "education": [{"institution","studyType","area","startDate","endDate","score"}],
  "awards": [{"title","date","summary"}]{JIS_SHAPE} }`;

const LANG_LABEL: Record<string, string> = {
  zh: "中文",
  en: "English",
  ja_shokumu: "日本語（職務経歴書）",
  ja_rirekisho: "日本語（履歴書）",
};

// 日文文书的追加指令与 x-jis 输出形状（docs/design/00 ADR-004：JIS 扩展段）
const JA_EXTRA: Record<string, string> = {
  ja_shokumu: `7. 職務経歴書の文体で書く：見出し体・簡潔、常体（だ・である調）または体言止め。数字は半角。
8. 追加で "x-jis" を出力する：
   - shokumuYoyaku（職務要約）：3〜4文。経験年数・専門領域・代表的実績を要約。
   - ikaseruKeiken（活かせる経験・知識）：事実包由来の箇条書き 3〜6 件。
   - jikoPR（自己PR）：200〜300字。事実包の実績のみ根拠に使う。`,
  ja_rirekisho: `7. 履歴書用の控えめで丁寧な文体（です・ます調）。学歴・職歴の表はテンプレート側で機械生成するため、work/education は事実のまま出力する。
8. 追加で "x-jis" を出力する：
   - shiboudouki（志望動機）：JD がある場合のみ 150〜250字で、事実包の経験と JD の接点を軸に書く。JD が無ければ省略。
   - jikoPR（自己PR）：150〜250字。
   - menkyoShikaku（免許・資格）：事実包に明記された資格・検定のみ（JLPT 等）。無ければ空配列。日付不明は date 省略。
   - furigana / birthDate / address / honninKibou：出力しない（本人が編集画面で記入する。推測・創作は厳禁）。`,
};

const JIS_SHAPE = `,
  "x-jis": { "shokumuYoyaku"?, "ikaseruKeiken"?:[], "jikoPR"?, "shiboudouki"?, "menkyoShikaku"?:[{"date"?,"name"}] }`;

// 英文简历追加：把工作许可状态注入到 basics.summary（外国人投美几乎必填）
const EN_EXTRA = `7. 若事实包包含「工作许可」信息（us_authorized / requires_sponsorship / other），在 basics.summary 末尾追加一句英文：
   - us_authorized → "Authorized to work in the United States; no visa sponsorship required."
   - requires_sponsorship → "Requires visa sponsorship to work in the United States."
   - other → 用一句英文简要说明实际情况（如 "Work authorization status: other."）。无该信息则不要添加。`;

export async function handleResumeGenerateJob(resumeId: string): Promise<void> {
  const resume = await prisma.resume.findUnique({ where: { id: resumeId } });
  if (!resume) throw new Error(`简历记录不存在: ${resumeId}`);
  const { userId } = resume;

  const run = await startRun({
    userId,
    kind: "resume_generate",
    inputRef: { resumeId, jdId: resume.jdId },
    promptVersion: PROMPT_VERSION,
  });
  const t0 = Date.now();

  try {
    const factPack = await buildFactPack(userId, resume.jdId);
    const lang = LANG_LABEL[resume.resumeType] ?? "中文";

    let result: JsonResume;
    let model = "mock";
    let tokens = { tokensIn: 0, tokensOut: 0 };

    if (isMock()) {
      result = programmaticResume(factPack);
    } else {
      const out = await generateWithLlm(factPack, lang, resume.resumeType);
      result = out.result;
      model = out.model;
      tokens = { tokensIn: out.tokensIn, tokensOut: out.tokensOut };
    }

    // 事实包含性校验：产出中的数字必须能在 FactPack 文本中找到
    result["x-warnings"] = containmentWarnings(result, factPack.digest);

    // 注：照片/地址/日本履历书个人信息等由「共享个人档案」统一管理，
    // 在导出/预览时由 mergePersonalIntoResume 统一注入，故此处不保留简历自身的个人字段。

    await prisma.resume.update({
      where: { id: resumeId },
      data: { resumeJson: result as unknown as Prisma.InputJsonValue, status: "draft" },
    });
    await finishRun(run.id, { ok: true, model, ...tokens, latencyMs: Date.now() - t0 });
  } catch (e) {
    await finishRun(run.id, { ok: false, error: String(e), latencyMs: Date.now() - t0 });
    throw e;
  }
}

const isMock = () =>
  process.env.AI_PROVIDER === "mock" || (!process.env.DEEPSEEK_API_KEY && !process.env.OPENAI_API_KEY);

// ===== FactPack =====

type FactPack = Awaited<ReturnType<typeof buildFactPack>>;

async function buildFactPack(userId: string, jdId: string | null) {
  const [user, profile, experiences, projects, skills, achievements, educations, honors] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: userId } }),
    prisma.careerProfile.findUnique({ where: { userId } }),
    prisma.careerExperience.findMany({ where: { userId, deletedAt: null }, orderBy: { startDate: "desc" } }),
    prisma.project.findMany({ where: { userId, deletedAt: null }, orderBy: { startDate: { sort: "desc", nulls: "last" } } }),
    prisma.skill.findMany({ where: { userId }, orderBy: { level: "desc" }, include: { _count: { select: { evidences: true } } } }),
    prisma.achievement.findMany({ where: { userId } }),
    prisma.education.findMany({ where: { userId }, orderBy: { startDate: { sort: "desc", nulls: "last" } } }),
    prisma.honor.findMany({ where: { userId }, orderBy: { sortOrder: "asc" } }),
  ]);
  if (experiences.length === 0 && projects.length === 0) {
    throw new Error("职业数据不足（无经历与项目），请先在知识库补充");
  }

  // JD 相关性：有匹配记录时按 matched_evidence 提升相关实体排序
  let relevantIds = new Set<string>();
  let jdContext = "";
  if (jdId) {
    const jd = await prisma.jobDescription.findUnique({
      where: { id: jdId },
      include: { matches: { orderBy: { createdAt: "desc" }, take: 1 } },
    });
    if (jd) {
      jdContext = `目标岗位：${[jd.company, jd.title].filter(Boolean).join(" · ")}\nJD 摘要：${jd.rawContent.slice(0, 1500)}`;
      const evidence = (jd.matches[0]?.matchedEvidence ?? []) as { entityId: string }[];
      relevantIds = new Set(evidence.map((e) => e.entityId));
    }
  }

  const fmtM = (d: Date | null) => (d ? d.toISOString().slice(0, 7) : "");
  const workAuthText =
    user.workAuthStatus === "us_authorized"
      ? "有美国工作许可（公民/绿卡/H1B 等），无需签证支持"
      : user.workAuthStatus === "requires_sponsorship"
        ? "需要签证支持才能在美国工作"
        : user.workAuthStatus === "other"
          ? "工作许可状态：其他"
          : "";
  const langText = Array.isArray(user.languages)
    ? (user.languages as { name: string; proficiency?: string | null }[])
        .map((l) => (l.proficiency ? `${l.name}(${l.proficiency})` : l.name))
        .join("、")
    : "";
  const snsText = Array.isArray(user.snsLinks)
    ? (user.snsLinks as { network: string; url: string }[]).map((s) => `${s.network}: ${s.url}`).join("、")
    : "";
  const digestParts = [
    `## 基本信息\n姓名：${user.name}｜邮箱：${user.email}｜手机：${user.mobile ?? ""}｜地区：${user.region ?? ""}｜意向城市：${user.preferredCity ?? ""}${workAuthText ? `｜工作许可：${workAuthText}` : ""}`,
    profile?.headline ? `职业定位：${profile.headline}\n综述：${profile.summary ?? ""}` : "",
    langText ? `语言：${langText}` : "",
    snsText ? `社交链接：${snsText}` : "",
    "## 工作经历",
    ...experiences.map(
      (e) =>
        `- ${e.company}｜${e.title}${e.employmentType === "internship" ? "（实习）" : ""}｜${fmtM(e.startDate)}~${e.endDate ? fmtM(e.endDate) : "至今"}｜${e.location ?? ""}\n  ${e.description ?? ""}\n  亮点：${e.highlights.join("；")}`,
    ),
    "## 项目",
    ...projects.map(
      (p) =>
        `- ${p.name}｜${p.role ?? ""}｜${fmtM(p.startDate)}~${fmtM(p.endDate)}\n  ${p.description ?? ""}\n  成果：${p.outcome ?? ""}\n  技术：${p.techStack.join("、")}`,
    ),
    "## 技能",
    skills.map((s) => `${s.name}(熟练度${s.level}，证据${s._count.evidences}条)`).join("、"),
    "## 成果",
    ...achievements.map((a) => `- ${a.title}：${a.metricValue ?? ""}${a.metricUnit ?? ""}${a.metricText ?? ""}`),
    honors.length > 0
      ? ["## 荣誉奖项", ...honors.map((h) => `- ${h.title}｜${h.issuer ?? ""}｜${h.date ? fmtM(h.date) : ""}`)].join("\n")
      : "",
    "## 教育",
    ...educations.map(
      (e) => `- ${e.school}｜${e.faculty ?? ""}｜${e.degree ?? ""}｜${e.major ?? ""}｜${fmtM(e.startDate)}~${fmtM(e.endDate)}`,
    ),
    jdContext,
  ].filter(Boolean);

  return {
    user, profile, experiences, projects, skills, achievements, educations, honors,
    relevantIds, jdContext,
    digest: digestParts.join("\n"),
  };
}

// ===== LLM 路径 =====

async function generateWithLlm(factPack: FactPack, lang: string, resumeType: string) {
  let lastError = "";
  let totals = { tokensIn: 0, tokensOut: 0, model: "" };
  const system = SYSTEM_PROMPT.replace("{LANG}", lang)
    .replace("{EXTRA}", JA_EXTRA[resumeType] ? `${JA_EXTRA[resumeType]}\n` : (resumeType === "en" ? `${EN_EXTRA}\n` : ""))
    .replace("{JIS_SHAPE}", JA_EXTRA[resumeType] ? JIS_SHAPE : "");
  for (let attempt = 0; attempt < 2; attempt++) {
    const user =
      attempt === 0
        ? `事实包：\n\n${factPack.digest.slice(0, 20_000)}`
        : `事实包：\n\n${factPack.digest.slice(0, 20_000)}\n\n上一次输出未通过校验：${lastError}\n请修正后重新输出完整 JSON。`;
    const res = await chat({ system, user, json: true });
    totals = { tokensIn: totals.tokensIn + res.tokensIn, tokensOut: totals.tokensOut + res.tokensOut, model: res.model };
    try {
      const parsed = jsonResume.safeParse(JSON.parse(res.content));
      if (parsed.success) return { result: parsed.data, ...totals };
      lastError = JSON.stringify(parsed.error.flatten().fieldErrors).slice(0, 400);
    } catch {
      lastError = "输出不是合法 JSON";
    }
  }
  throw new Error(`简历生成两次校验均失败：${lastError}`);
}

// ===== mock 路径：程序化映射（零幻觉，无 key 时的可靠兜底） =====

function programmaticResume(fp: FactPack): JsonResume {
  const fmtM = (d: Date | null) => (d ? d.toISOString().slice(0, 7) : undefined);
  const relevanceSort = <T extends { id: string }>(items: T[]) =>
    fp.relevantIds.size === 0
      ? items
      : [...items].sort((a, b) => Number(fp.relevantIds.has(b.id)) - Number(fp.relevantIds.has(a.id)));

  const snsLinks = Array.isArray(fp.user.snsLinks)
    ? (fp.user.snsLinks as { network: string; url: string; username?: string }[])
    : [];
  const languages = Array.isArray(fp.user.languages)
    ? (fp.user.languages as { name: string; proficiency?: string | null }[])
    : [];

  return jsonResume.parse({
    basics: {
      name: fp.user.name,
      label: fp.profile?.headline ?? undefined,
      email: fp.user.email,
      phone: fp.user.mobile ?? undefined,
      location: fp.user.preferredCity ?? fp.user.region ?? undefined,
      summary: fp.profile?.summary ?? undefined,
      url: snsLinks.find((s) => /linkedin|personal|个人|blog|site/i.test(s.network))?.url ?? undefined,
      profiles: snsLinks.map((s) => ({ network: s.network, url: s.url, username: s.username })),
    },
    work: relevanceSort(fp.experiences).map((e) => ({
      name: e.company,
      position: e.title + (e.employmentType === "internship" ? "（实习）" : ""),
      startDate: fmtM(e.startDate),
      endDate: e.endDate ? fmtM(e.endDate) : undefined,
      location: e.location ?? undefined,
      summary: e.description ?? undefined,
      highlights: e.highlights,
    })),
    projects: relevanceSort(fp.projects).map((p) => ({
      name: p.name,
      description: [p.description, p.outcome].filter(Boolean).join(" ") || undefined,
      keywords: p.techStack,
      roles: p.role ? [p.role] : [],
      startDate: fmtM(p.startDate),
      endDate: fmtM(p.endDate),
      highlights: [],
    })),
    skills: fp.skills.map((s) => ({
      name: s.name,
      level: s.level >= 80 ? "精通" : s.level >= 60 ? "熟练" : "掌握",
      keywords: [],
    })),
    education: fp.educations.map((e) => ({
      institution: e.school,
      studyType: [e.faculty, e.degree].filter(Boolean).join(" · ") || undefined,
      area: e.major ?? undefined,
      startDate: fmtM(e.startDate),
      endDate: fmtM(e.endDate),
      score: e.gpa ?? undefined,
    })),
    awards: [
      ...fp.achievements.map((a) => ({
        title: `${a.title}${a.metricValue != null ? `：${a.metricValue}${a.metricUnit ?? ""}` : a.metricText ? `：${a.metricText}` : ""}`,
        date: a.occurredAt ? a.occurredAt.toISOString().slice(0, 7) : undefined,
      })),
      ...fp.honors.map((h) => ({
        title: h.title,
        issuer: h.issuer ?? undefined,
        date: h.date ? fmtM(h.date) : undefined,
        summary: h.description ?? undefined,
      })),
    ],
    "x-meta": {
      languages: languages.map((l) => (l.proficiency ? `${l.name}（${l.proficiency}）` : l.name)),
    },
  });
}

// ===== 事实包含性校验 =====

function containmentWarnings(resume: JsonResume, digest: string): string[] {
  const warnings: string[] = [];
  const digestNumbers = new Set(digest.match(/\d+(?:\.\d+)?/g) ?? []);

  const checkText = (path: string, text: string | undefined) => {
    if (!text) return;
    for (const num of text.match(/\d+(?:\.\d+)?/g) ?? []) {
      // 年月日期不校验（格式转换来自事实包日期）
      if (/^(19|20)\d{2}$/.test(num) || /^\d{1,2}$/.test(num)) continue;
      if (!digestNumbers.has(num)) warnings.push(`${path}：数字「${num}」未在职业数据库中找到，请核实`);
    }
  };

  resume.work.forEach((w, i) => {
    checkText(`work[${i}].summary`, w.summary);
    w.highlights.forEach((h, j) => checkText(`work[${i}].highlights[${j}]`, h));
  });
  resume.projects.forEach((p, i) => checkText(`projects[${i}].description`, p.description));
  checkText("basics.summary", resume.basics.summary);
  return warnings.slice(0, 20);
}
