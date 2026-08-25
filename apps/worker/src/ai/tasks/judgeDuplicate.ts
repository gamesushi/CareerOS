import { z } from "zod";
import { chat } from "../provider";
import type { MergeItem, SectionKind } from "@careeros/shared";

export const PROMPT_VERSION = "judge-dup-v2";

const BASE_SYSTEM = `你是一个严谨的简历去重裁判。给定同一人的两段「同类型」的简历分栏（可能来自不同版本的简历），判断它们是否代表「同一个真实实体」。

判定原则：
1. 只有当两者几乎肯定是同一实体时才判 same=true；时间明显不重叠或身份明显不同则 same=false。
2. 措辞/拼写差异不应影响判定（如「高级研究员」vs「研究员（用户体验中心）」、中英文公司名混用）。
3. confidence：两份信息都清晰且高度吻合为 "high"；需一定推断但很可能为同一实体为 "mid"；信息残缺、难以确定时为 "low"。
4. reason 用一句中文说明判断依据（≤40字）。

只输出 JSON，不要任何额外内容：
{ "same": boolean, "confidence": "high"|"mid"|"low", "reason": string }`;

// 各分栏的判定语义与字段重点（拼到 BASE_SYSTEM 后）
const KIND_GUIDANCE: Record<SectionKind, string> = {
  work: `这是「工作经历」。重点看「公司是否同一家」+「任职时间是否重叠 / 相接」+「职位是否实质相同」。`,
  project: `这是「项目经历」。重点看「项目名称是否同一」+「所属公司是否同一」+「时间是否重叠」。同名项目且时间重叠大概率为同一项目。`,
  achievement: `这是「成果 / 业绩」。重点看「成果标题是否同一表述」+「发生时间是否一致」。量化指标不同但标题与时间一致通常为同一成果。`,
  education: `这是「教育经历」。重点看「学校是否同一所」+「学位/专业是否一致」+「就读时间是否重叠」。同名学校且时间重叠或同学位大概率为同一段教育。`,
  honor: `这是「荣誉奖项」。重点看「奖项名称是否同一」+「颁发机构是否同一」+「获得时间是否一致」。同名奖项且颁发方或时间一致大概率为同一奖项。`,
};

function compact(e: MergeItem): string {
  const lines: string[] = [];
  if (e.primary) lines.push(`主体: ${e.primary}`);
  if (e.secondary) lines.push(`附属: ${e.secondary}`);
  lines.push(`时间: ${e.startDate ?? "?"} ~ ${e.endDate ?? "至今"}`);
  const raw = e.raw as Record<string, unknown>;
  if (raw.description) lines.push(`描述: ${String(raw.description).slice(0, 600)}`);
  if (raw.outcome) lines.push(`结果: ${String(raw.outcome).slice(0, 400)}`);
  if (raw.metricText) lines.push(`指标: ${String(raw.metricText).slice(0, 200)}`);
  if (Array.isArray(raw.highlights) && raw.highlights.length) {
    lines.push(`要点: ${(raw.highlights as string[]).slice(0, 8).join(" / ")}`);
  }
  if (Array.isArray(raw.techStack) && raw.techStack.length) {
    lines.push(`技术栈: ${(raw.techStack as string[]).slice(0, 12).join(", ")}`);
  }
  return lines.join("\n");
}

export async function judgeDuplicate(a: MergeItem, b: MergeItem, kind: SectionKind): Promise<JudgeResult> {
  const system = `${BASE_SYSTEM}\n\n${KIND_GUIDANCE[kind]}`;
  const user = `分栏类型：${kind}\n\nA：\n${compact(a)}\n\nB：\n${compact(b)}`;

  let lastError = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await chat({
      system,
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

const OUT_SCHEMA = z.object({
  same: z.boolean(),
  confidence: z.enum(["high", "mid", "low"]),
  reason: z.string().max(200),
});

export type JudgeResult = z.infer<typeof OUT_SCHEMA>;
