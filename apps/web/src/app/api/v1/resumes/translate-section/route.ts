import { z } from "zod";
import { handler, ok, parseBody, requireUser, ApiError } from "@/lib/api";
import { chat } from "@/lib/ai";

const translateSectionInput = z.object({
  section: z.enum(["work", "projects", "basics", "skills", "education", "awards", "all"]),
  data: z.any(),
  targetLang: z.string().min(1),
});

const SYSTEM_PROMPT_SECTION = `You are a professional resume localization expert.
Your task is to translate the given resume section JSON into the requested target language ({TARGET_LANG}).

Strict requirements:
1. Translate all textual fields into {TARGET_LANG} accurately, idiomatically, and professionally.
2. For company names, localized or universally accepted names may be used (e.g. "Google" -> "Google", "网易游戏" -> "NetEase Games", "GameSushi株式会社" -> "GameSushi Co., Ltd.").
3. For position titles, use standard industry terms in {TARGET_LANG} (e.g. "Senior Researcher" -> "Senior Researcher" / "高级研究员").
4. Maintain the exact JSON array structure, object keys, date formats, bullet point counts, and ordering intact.
5. Return ONLY a valid JSON object with a single root key "items" containing the translated array.`;

const SYSTEM_PROMPT_ALL = `You are a world-class executive resume translator.
Your task is to translate an ENTIRE resume JSON into the requested target language ({TARGET_LANG}).

Strict requirements:
1. Translate ALL text fields across all sections into {TARGET_LANG}:
   - basics: name (romanize/translate if applicable, e.g. "何北航" -> "He Beihang"), label (headline), summary, location.
   - work: company name, position title, summary, highlights.
   - projects: project name, roles, description, highlights, keywords.
   - education: institution (school name, e.g. "Hokkaido University"), area (major, e.g. "International Media"), studyType (degree, e.g. "Master's Degree").
   - skills: skill names, level descriptions.
   - awards: title, summary.
2. Preserve all non-textual fields, dates, phone numbers, emails, URLs, and JSON keys intact.
3. Replace date labels such as "至今" with standard terms in {TARGET_LANG} (e.g. "Present" for English, "現在" for Japanese).
4. Return ONLY a valid JSON object representing the translated resume (with keys basics, work, projects, education, skills, awards, etc.).`;

export const POST = handler(async (req) => {
  await requireUser();
  const input = await parseBody(req, translateSectionInput);
  const { section, data, targetLang } = input;

  if (!data) {
    throw new ApiError(400, "invalid_input", "待翻译的数据为空");
  }

  if (section === "all") {
    const system = SYSTEM_PROMPT_ALL.replace(/\{TARGET_LANG\}/g, targetLang);
    const userMsg = `请将以下整份简历 JSON 完整翻译为 ${targetLang}：\n\n${JSON.stringify(data, null, 2)}`;
    try {
      const res = await chat({
        system,
        user: userMsg,
        json: true,
        temperature: 0.2,
      });
      const raw = res.content.trim().replace(/^```json\s*/i, "").replace(/\s*```$/, "");
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      return ok({ resume: parsed });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "全篇翻译异常";
      throw new ApiError(500, "translation_failed", `翻译失败: ${msg}`);
    }
  }

  const system = SYSTEM_PROMPT_SECTION.replace(/\{TARGET_LANG\}/g, targetLang);
  const userMsg = `请将以下 ${section} 模块的数据精准翻译为 ${targetLang}：\n\n${JSON.stringify(data, null, 2)}`;

  try {
    const res = await chat({
      system,
      user: userMsg,
      json: true,
      temperature: 0.2,
    });

    const raw = res.content.trim().replace(/^```json\s*/i, "").replace(/\s*```$/, "");
    const parsed = JSON.parse(raw) as { items?: unknown[] } | unknown[];
    const items = Array.isArray(parsed) ? parsed : Array.isArray(parsed.items) ? parsed.items : null;

    if (!items || items.length === 0) {
      throw new Error("LLM 返回结构不匹配");
    }

    return ok({ items });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "翻译服务异常";
    throw new ApiError(500, "translation_failed", `翻译失败: ${msg}`);
  }
});
