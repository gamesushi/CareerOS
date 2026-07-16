import { extractionResult, type ExtractionResult } from "@careeros/shared";
import { chat } from "../provider";

export const PROMPT_VERSION = "resume-parse-v1";

const SYSTEM_PROMPT = `你是一个简历结构化抽取引擎。从用户提供的简历原文（Markdown）中抽取结构化职业数据，输出一个 JSON 对象。

硬性规则：
1. 只抽取原文中明确存在的信息，禁止推断、补全或美化。找不到的字段输出 null。
2. 日期尽量精确：有日到日（YYYY-MM-DD），只有月到月（YYYY-MM），只有年到年（YYYY）。"至今/现在/present" 的结束日期输出 null。
3. 每条工作经历和项目给出 confidence：原文清晰完整为 "high"，需要少量语义理解为 "mid"，原文含糊或字段大量缺失为 "low"。
4. highlights 是该经历下的条目式职责/业绩（保留原文语言，逐条拆分）。
5. 项目若能从上下文判断所属公司，填 belongsToCompany（公司名原文），否则 null。
6. 技能包括显式技能清单和正文中反复出现的专业能力；evidenceHint 填原文出处片段（≤50字）。
7. 成果（achievements）指含量化指标或明确结果的表述，metricValue/metricUnit 拆出数字与单位，无法量化的填 metricText。
8. 保留原文语言，不要翻译。

输出 JSON 结构（严格遵守，不要输出任何 JSON 之外的内容）：
{
  "basics": { "name": string|null, "email": string|null, "phone": string|null, "location": string|null, "links": string[], "summary": string|null },
  "experiences": [{ "company": string, "title": string, "startDate": string|null, "endDate": string|null, "location": string|null, "description": string|null, "highlights": string[], "confidence": "high"|"mid"|"low" }],
  "projects": [{ "name": string, "role": string|null, "startDate": string|null, "endDate": string|null, "description": string|null, "outcome": string|null, "techStack": string[], "belongsToCompany": string|null, "confidence": "high"|"mid"|"low" }],
  "skills": [{ "name": string, "category": "language"|"framework"|"tool"|"domain"|"soft"|null, "evidenceHint": string|null }],
  "achievements": [{ "title": string, "metricValue": number|null, "metricUnit": string|null, "metricText": string|null, "context": string|null }],
  "educations": [{ "school": string, "degree": string|null, "major": string|null, "startDate": string|null, "endDate": string|null }]
}`;

const MAX_INPUT_CHARS = 30_000;

export async function runResumeParse(
  rawMarkdown: string,
): Promise<{ result: ExtractionResult; model: string; tokensIn: number; tokensOut: number }> {
  const input = rawMarkdown.slice(0, MAX_INPUT_CHARS);

  let lastError = "";
  let totals = { tokensIn: 0, tokensOut: 0, model: "" };

  // zod 校验失败自动重试 1 次，把错误信息带回给模型（docs/design/04 §0 约定）
  for (let attempt = 0; attempt < 2; attempt++) {
    const user =
      attempt === 0
        ? `简历原文：\n\n${input}`
        : `简历原文：\n\n${input}\n\n上一次输出未通过校验，错误：${lastError}\n请修正后重新输出完整 JSON。`;

    const res = await chat({ system: SYSTEM_PROMPT, user, json: true });
    totals = {
      tokensIn: totals.tokensIn + res.tokensIn,
      tokensOut: totals.tokensOut + res.tokensOut,
      model: res.model,
    };

    let parsed: unknown;
    try {
      parsed = JSON.parse(res.content);
    } catch {
      lastError = "输出不是合法 JSON";
      continue;
    }
    const validated = extractionResult.safeParse(parsed);
    if (validated.success) {
      return { result: validated.data, ...totals };
    }
    lastError = JSON.stringify(validated.error.flatten().fieldErrors).slice(0, 500);
  }

  throw new Error(`抽取结果两次校验均失败：${lastError}`);
}
