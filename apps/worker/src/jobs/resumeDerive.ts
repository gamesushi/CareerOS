import { prisma, Prisma, type ResumeType } from "@careeros/db";
import { jsonResume, type JsonResume } from "@careeros/shared";
import { chat } from "../ai/provider";
import { startRun, finishRun } from "../ai/audit";

export const PROMPT_VERSION = "resume-derive-v1";

const SYSTEM_PROMPT = `你是简历翻译与精修专家。你的任务是将一份已编辑好的 JSON Resume 准确、地道地翻译并适配到目标语言格式。

硬性规则：
1. 必须完全保留原始简历的结构与选材，包括所有工作经历、项目经历、技能、教育经历的条目数量与顺序。
2. 禁止新增原始简历中不存在的事实、数字或成果；仅对已有文本（summary、highlights、description、title 等）进行准确、专业地道的翻译与词汇润色。
3. 目标语言：{LANG}。
4. 日期格式保持不变。
{EXTRA}
输出 JSON（严格遵守 JSON Resume 标准格式）：
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

const JA_EXTRA: Record<string, string> = {
  ja_shokumu: `5. 職務経歴書の文体で書く：見出し体・簡潔、常体（だ・である調）または体言止め。数字は半角。
6. 追加で "x-jis" を出力する：
   - shokumuYoyaku（職務要約）：3〜4文。
   - ikaseruKeiken（活かせる経験・知識）：箇条書き 3〜6 件。
   - jikoPR（自己PR）：200〜300字。`,
  ja_rirekisho: `5. 履歴書用の控えめで丁寧な文体（です・ます調）。
6. 追加で "x-jis" を出力する：
   - shiboudouki（志望動機）：150〜250字。
   - jikoPR（自己PR）：150〜250字。
   - menkyoShikaku（免許・資格）：資格・検定のみ。`,
};

const JIS_SHAPE = `,
  "x-jis": { "shokumuYoyaku"?, "ikaseruKeiken"?:[], "jikoPR"?, "shiboudouki"?, "menkyoShikaku"?:[{"date"?,"name"}] }`;

export async function handleResumeDeriveJob(
  resumeId: string,
  sourceResumeId: string,
  targetType: ResumeType,
): Promise<void> {
  const [resume, sourceResume] = await Promise.all([
    prisma.resume.findUnique({ where: { id: resumeId } }),
    prisma.resume.findUnique({ where: { id: sourceResumeId } }),
  ]);
  if (!resume) throw new Error(`简历记录不存在: ${resumeId}`);
  if (!sourceResume) throw new Error(`源简历记录不存在: ${sourceResumeId}`);

  const { userId } = resume;
  const run = await startRun({
    userId,
    kind: "resume_generate",
    inputRef: { resumeId, sourceResumeId, targetType },
    promptVersion: PROMPT_VERSION,
  });
  const t0 = Date.now();

  try {
    const sourceJson = sourceResume.resumeJson as unknown as JsonResume;
    const lang = LANG_LABEL[targetType] ?? "English";

    let result: JsonResume;
    let model = "mock";
    let tokens = { tokensIn: 0, tokensOut: 0 };

    if (isMock() || !sourceJson || Object.keys(sourceJson).length === 0) {
      result = sourceJson && Object.keys(sourceJson).length > 0 ? sourceJson : fallbackResume();
    } else {
      const out = await translateWithLlm(sourceJson, lang, targetType);
      result = out.result;
      model = out.model;
      tokens = { tokensIn: out.tokensIn, tokensOut: out.tokensOut };
    }

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

async function translateWithLlm(sourceJson: JsonResume, lang: string, targetType: string) {
  const extra = JA_EXTRA[targetType] ?? "";
  const system = SYSTEM_PROMPT.replace("{LANG}", lang)
    .replace("{EXTRA}", extra)
    .replace("{JIS_SHAPE}", extra ? JIS_SHAPE : "");

  const userMessage = `请将以下 JSON Resume 准确地道地翻译并适配为 ${lang} 目标格式：\n\n${JSON.stringify(sourceJson, null, 2)}`;

  const res = await chat({ system, user: userMessage, json: true });

  const raw = res.content.trim().replace(/^```json\s*/i, "").replace(/\s*```$/, "");
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch (e) {
    throw new Error(`LLM 产出无效 JSON: ${raw.slice(0, 200)}`);
  }

  const parsed = jsonResume.safeParse(json);
  if (!parsed.success) {
    throw new Error(`LLM 产出未能通过 Schema 校验: ${parsed.error.message}`);
  }
  return { result: parsed.data, model: res.model, tokensIn: res.tokensIn, tokensOut: res.tokensOut };
}

function fallbackResume(): JsonResume {
  return jsonResume.parse({
    basics: { name: "Applicant", label: "Candidate", summary: "Experienced professional.", profiles: [] },
    work: [],
    projects: [],
    skills: [],
    education: [],
    awards: [],
  });
}
