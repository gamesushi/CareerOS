import { jdParsed, type JdParsed } from "@careeros/shared";
import { chat } from "../provider";

export const PROMPT_VERSION = "jd-parse-v1";

const SYSTEM_PROMPT = `你是一个招聘 JD 结构化解析引擎。从 JD 原文中抽取结构化要求，输出 JSON。

规则：
1. 只抽取原文明确存在的信息，禁止推断补全；找不到输出 null 或空数组。
2. 先判断 JD 原文的【语言】，在 lang 字段输出："zh"（中文）/"en"（英文）/"ja"（日文）。
3. 字段值（skills.name、experience.desc、industry、keywords、languages 等）一律使用【JD 原文的【语言】】填写：
   - 中文 JD → 中文；英文 JD → 英文；日文 JD → 日文。绝不把内容翻译成中文或英文。
4. skills：技能/工具/方法要求。required=是否硬性要求（"必须/精通/required" 为 true，"加分/优先/nice to have" 为 false）。weight 1-5 表示重要程度（标题或首条为 5，加分项为 1-2）。
5. experience：经验类要求逐条列出（如 "5年以上手游发行经验"），yearsMin 抽出最低年限数字。
6. industry：行业标签（中文 JD 如 游戏/金融/电商；英文 JD 如 Biotechnology/Pharmaceuticals/Biostatistics）。keywords：其他高频关键词。
7. languages：语言要求。seniority：职级（junior/mid/senior/manager/director）。
8. 学术/教授/研究员类岗位：把「研究方向/领域」作为 skills（required 视情况），「博士学位/年限要求」作为 experience（yearsMin），「学科/院系/专业领域」作为 industry。

输出 JSON：
{ "lang": "zh"|"en"|"ja",
  "company": string|null, "title": string|null,
  "skills": [{"name": string, "required": boolean, "weight": 1-5}],
  "experience": [{"desc": string, "yearsMin": number|null}],
  "industry": string[], "keywords": string[], "languages": string[],
  "seniority": string|null, "location": string|null, "salaryRange": string|null }`;

export async function runJdParse(
  rawContent: string,
): Promise<{ result: JdParsed; model: string; tokensIn: number; tokensOut: number }> {
  const input = rawContent.slice(0, 20_000);
  let lastError = "";
  let totals = { tokensIn: 0, tokensOut: 0, model: "" };

  for (let attempt = 0; attempt < 2; attempt++) {
    const user =
      attempt === 0
        ? `JD 原文：\n\n${input}`
        : `JD 原文：\n\n${input}\n\n上一次输出未通过校验：${lastError}\n请修正后重新输出完整 JSON。`;
    const res = await chat({ system: SYSTEM_PROMPT, user, json: true });
    totals = {
      tokensIn: totals.tokensIn + res.tokensIn,
      tokensOut: totals.tokensOut + res.tokensOut,
      model: res.model,
    };
    try {
      const parsed = jdParsed.safeParse(JSON.parse(res.content));
      if (parsed.success) return { result: parsed.data, ...totals };
      lastError = JSON.stringify(parsed.error.flatten().fieldErrors).slice(0, 400);
    } catch {
      lastError = "输出不是合法 JSON";
    }
  }
  throw new Error(`JD 解析两次校验均失败：${lastError}`);
}
