import { z } from "zod";
import { chat } from "../provider";
import type { ExpFields } from "@careeros/shared";

export const PROMPT_VERSION = "judge-dup-v1";

const SYSTEM_PROMPT = `你是一个严谨的简历去重裁判。给定同一人的两段工作经历（可能来自不同版本的简历），判断它们是否代表「同一段真实的工作 / 同一家公司里的同一段任职」。

判定原则：
1. 重点看「公司是否同一家」+「任职时间是否重叠 / 相接」+「职位是否实质相同」。措辞差异（如「高级研究员」vs「研究员（用户体验中心）」、「产品经理」vs「项目经理（网络金融部）」）不应影响判定。
2. 只有当两者几乎肯定是同一段任职时才判 same=true；时间不重叠或公司明显不同则 same=false。
3. confidence：两份信息都清晰且高度吻合为 "high"；需一定推断但很可能为同一段为 "mid"；信息残缺、难以确定时为 "low"。
4. reason 用一句中文说明判断依据（≤40字）。

只输出 JSON，不要任何额外内容：
{ "same": boolean, "confidence": "high"|"mid"|"low", "reason": string }`;

const OUT_SCHEMA = z.object({
  same: z.boolean(),
  confidence: z.enum(["high", "mid", "low"]),
  reason: z.string().max(200),
});

export type JudgeResult = z.infer<typeof OUT_SCHEMA>;

function compact(e: ExpFields): string {
  const lines = [
    `公司: ${e.company}`,
    `职位: ${e.title}`,
    `时间: ${e.startDate ?? "?"} ~ ${e.endDate ?? "至今"}`,
  ];
  if (e.location) lines.push(`地点: ${e.location}`);
  if (e.description) lines.push(`描述: ${e.description.slice(0, 600)}`);
  if (e.highlights?.length) lines.push(`要点: ${e.highlights.slice(0, 8).join(" / ")}`);
  return lines.join("\n");
}

export async function judgeDuplicate(a: ExpFields, b: ExpFields): Promise<JudgeResult> {
  const user = `经历 A：\n${compact(a)}\n\n经历 B：\n${compact(b)}`;

  let lastError = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await chat({
      system: SYSTEM_PROMPT,
      user: attempt === 0 ? user : `${user}\n\n上一次输出未通过校验：${lastError}\n请重新输出合法 JSON。`,
      json: true,
      temperature: 0,
    });
    let parsed: unknown;
    try {
      parsed = JSON.parse(res.content);
    } catch {
      lastError = "输出不是合法 JSON";
      continue;
    }
    const v = OUT_SCHEMA.safeParse(parsed);
    if (v.success) return v.data;
    lastError = JSON.stringify(v.error.flatten().fieldErrors).slice(0, 300);
  }
  // 校验两次失败 → 保守判定为不同，避免误合并
  return { same: false, confidence: "low", reason: "模型判定失败，保守视为不同" };
}
