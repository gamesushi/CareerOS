import { extractionResult, type ExtractionResult } from "@careeros/shared";
import { chat } from "../provider";

export const PROMPT_VERSION = "resume-parse-v2";

const SYSTEM_PROMPT = `你是一个简历结构化抽取引擎。从用户提供的简历原文（Markdown）中抽取结构化职业数据，输出一个 JSON 对象。

硬性规则：
1. 只抽取原文中明确存在的信息，禁止推断、补全或美化。找不到的字段输出 null。
2. 日期尽量精确：有日到日（YYYY-MM-DD），只有月到月（YYYY-MM），只有年到年（YYYY）。"至今/现在/present" 的结束日期输出 null。
3. 每条工作经历和项目给出 confidence：原文清晰完整为 "high"，需要少量语义理解为 "mid"，原文含糊或字段大量缺失为 "low"。
4. highlights 是该经历下的条目式职责/业绩（保留原文语言，逐条拆分）。
5. 项目若能从上下文判断所属公司，填 belongsToCompany（公司名原文），否则 null。
6. 技能包括显式技能清单和正文中反复出现的专业能力；evidenceHint 填原文出处片段（≤50字）。
7. 成果（achievements）指含量化指标或明确结果的表述，metricValue/metricUnit 拆出数字与单位，无法量化的填 metricText。
8. 荣誉奖项（honors）指「获奖 / 奖学金 / 竞赛名次 / 认证证书 / 荣誉称号」等，title 为奖项名，issuer 为颁发机构，date 为获得时间（规则2），description 为补充说明。
9. 保留原文语言，不要翻译。
10. 工作经历如有明确的部门 / 事业部 / 团队（如「支付事业部」「基础架构组」「Data Platform Team」），填 department（保留原文语言），否则 null。department 与 company/title 相互独立，不可合并。

输出 JSON 结构（严格遵守，不要输出任何 JSON 之外的内容）：
{
  "basics": { "name": string|null, "email": string|null, "phone": string|null, "location": string|null, "links": string[], "summary": string|null },
  "experiences": [{ "company": string, "title": string, "department": string|null, "startDate": string|null, "endDate": string|null, "location": string|null, "description": string|null, "highlights": string[], "confidence": "high"|"mid"|"low" }],
  "projects": [{ "name": string, "role": string|null, "startDate": string|null, "endDate": string|null, "description": string|null, "outcome": string|null, "techStack": string[], "belongsToCompany": string|null, "confidence": "high"|"mid"|"low" }],
  "skills": [{ "name": string, "category": "language"|"framework"|"tool"|"domain"|"soft"|null, "evidenceHint": string|null }],
  "achievements": [{ "title": string, "metricValue": number|null, "metricUnit": string|null, "metricText": string|null, "context": string|null }],
  "educations": [{ "school": string, "degree": string|null, "major": string|null, "startDate": string|null, "endDate": string|null }],
  "honors": [{ "title": string, "issuer": string|null, "date": string|null, "description": string|null }]
}

输出示例（experiences 和 projects 的每个元素必须是对象，不能是字符串、null 或数组）：
{
  "experiences": [
    {
      "company": "示例科技有限公司",
      "title": "高级后端工程师",
      "department": "支付事业部",
      "startDate": "2021-03",
      "endDate": null,
      "location": "上海",
      "description": "负责微服务架构设计与核心 API 开发。",
      "highlights": ["主导订单服务重构，接口响应时间下降 50%", "设计并落地 CI/CD 流水线"],
      "confidence": "high"
    }
  ],
  "projects": [
    {
      "name": "智能客服平台",
      "role": "技术负责人",
      "startDate": "2022-06",
      "endDate": "2023-12",
      "description": "基于大模型的企业智能客服系统。",
      "outcome": "覆盖 80% 常见问题，人工介入率下降 60%。",
      "techStack": ["Python", "FastAPI", "React"],
      "belongsToCompany": "示例科技有限公司",
      "confidence": "mid"
    }
  ],
  "honors": [
    {
      "title": "校级优秀毕业生",
      "issuer": "示例大学",
      "date": "2020-06",
      "description": "全年级前 5% 获得"
    },
    {
      "title": "ACM-ICPC 区域赛金奖",
      "issuer": "中国计算机学会",
      "date": "2019",
      "description": null
    }
  ]
}

特别注意：
- experiences 和 projects 必须是数组，且每个元素必须是对象，不能是字符串、null 或数组。如果原文经历信息不明确，可以输出空数组 []。
- honors 必须是数组，每个元素为对象 { "title": string, "issuer": string|null, "date": string|null, "description": string|null }；找不到奖项时输出空数组 []。
- confidence 只能取 "high"、"mid"、"low" 三者之一，不能用中文或空字符串。
- 教育经历（educations）的 startDate/endDate 必须严格按规则2抽取：有日到日、只有月到月、只有年到年；"至今/现在/present" 的结束日期输出 null。找不到的字段输出 null，禁止推断。
`;

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
        : `简历原文：\n\n${input}\n\n上一次输出未通过校验，错误：${lastError}\n请按 system prompt 中的输出示例格式修正，特别注意 experiences/projects/honors 每项必须是对象、confidence 必须是 "high"/"mid"/"low" 之一。重新输出完整 JSON。`;

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
    const flatErrors = validated.error.flatten().fieldErrors;
    const firstBadExperience = (parsed as any)?.experiences?.find(
      (x: unknown) => typeof x !== "object" || x === null || Array.isArray(x),
    );
    const firstBadProject = (parsed as any)?.projects?.find(
      (x: unknown) => typeof x !== "object" || x === null || Array.isArray(x),
    );
    const firstBadHonor = (parsed as any)?.honors?.find(
      (x: unknown) => typeof x !== "object" || x === null || Array.isArray(x),
    );
    const hints: string[] = [];
    if (firstBadExperience) {
      hints.push(
        `experiences 出现非对象元素示例：${JSON.stringify(firstBadExperience).slice(0, 120)}，必须改为对象`,
      );
    }
    if (firstBadProject) {
      hints.push(
        `projects 出现非对象元素示例：${JSON.stringify(firstBadProject).slice(0, 120)}，必须改为对象`,
      );
    }
    if (firstBadHonor) {
      hints.push(
        `honors 出现非对象元素示例：${JSON.stringify(firstBadHonor).slice(0, 120)}，必须改为对象`,
      );
    }
    lastError = JSON.stringify({ errors: flatErrors, hints }).slice(0, 500);
  }

  throw new Error(`抽取结果两次校验均失败：${lastError}`);
}
