import { jdParsed, type JdParsed } from "@careeros/shared";
import { chat } from "../provider";

export const PROMPT_VERSION = "jd-parse-v1";

const SYSTEM_PROMPT = `你是一个招聘 JD 结构化解析引擎。从 JD 原文中抽取结构化要求，输出 JSON。

规则：
1. 只抽取原文明确存在的信息，禁止推断补全；找不到输出 null 或空数组。
2. skills：技能/工具/方法要求。required=是否硬性要求（"必须/精通/required" 为 true，"加分/优先/nice to have" 为 false）。weight 1-5 表示该技能在 JD 中的重要程度（出现在标题或首条为 5，加分项为 1-2）。
3. experience：经验类要求逐条列出（如"5年以上手游发行经验"），yearsMin 抽出最低年限数字。
4. industry：行业标签（如 游戏/金融/电商）。keywords：其他高频关键词。
5. languages：语言要求。seniority：职级（junior/mid/senior/manager/director）。
6. 保留原文语言。

输出 JSON：
{ "company": string|null, "title": string|null,
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
