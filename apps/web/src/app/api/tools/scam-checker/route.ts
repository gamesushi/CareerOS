import { z } from "zod";
import { handler, ok, parseBody, ApiError } from "@/lib/api";
import { chat } from "@/lib/ai";
import { ipRateLimited, clientIp } from "@/lib/rate-limit";

export const runtime = "nodejs";

const INPUT_MAX = 8000;

const bodySchema = z.object({
  text: z.string().trim().min(10, "招聘文太短，请粘贴更完整的岗位描述").max(INPUT_MAX),
});

export type ScamFlag = {
  type: string;
  severity: "high" | "medium" | "low";
  detail: string;
};

export type ScamResult = {
  riskLevel: "high" | "medium" | "low" | "safe";
  summary: string;
  flags: ScamFlag[];
  mock?: boolean;
};

const SYSTEM_PROMPT = `你是一个面向中文招聘市场的「幽灵岗 / 诈骗招聘」检测助手。用户会粘贴一段招聘文案，你需要识别其中的红旗（red flags）并给出风险等级。

判断规则（中文市场本地化，注意与美国市场不同）：
- 高危红旗：要求预付费用（押金 / 培训费 / 服装费 / 体检费）、所谓「培训贷 / 贷款上岗」、要求刷单 / 充值 / 垫付、要求提供身份证/银行卡/验证码等敏感证件信息、要求私下微信/支付宝转账。
- 中危红旗：薪资描述极度模糊或明显偏离市场（如「日薪过万无要求」）、公司信息缺失或无法核实、岗位与要求严重不符、要求用非正规聊天软件（如某些小众 IM）面试且回避正规流程。
- 低危红旗：只留个人微信/QQ 联系（注意：国内 HR 常用个人微信/QQ 联系，单独出现不必然算红旗，但若同时伴随其它红旗则升级）、过度承诺「保offer/包过」、急迫催促马上转账或交资料。
- 若文案无明显红旗，给出 riskLevel=「safe」并说明原因。

只输出 JSON，不要任何解释性文字，严格遵循以下 schema：
{
  "riskLevel": "high" | "medium" | "low" | "safe",
  "summary": "一句话风险结论（中文）",
  "flags": [
    { "type": "红旗类别（中文，如 入职押金/培训贷/刷单垫付/敏感信息索取/薪资模糊/公司不可核/私下转账）",
      "severity": "high" | "medium" | "low",
      "detail": "结合原文的具体说明（中文，指出问题所在）" }
  ]
}
flags 为空数组表示未发现红旗。`;

function sampleScamResult(): ScamResult {
  return {
    riskLevel: "high",
    summary: "演示模式：检测到典型高危红旗（培训贷 + 私下转账），请配置 AI Key 获取真实分析。",
    mock: true,
    flags: [
      {
        type: "培训贷",
        severity: "high",
        detail: "文案要求「入职前需通过合作机构办理培训分期」，属典型培训贷红旗。",
      },
      {
        type: "私下转账",
        severity: "high",
        detail: "要求添加微信并「先交 200 元占位费」，正规招聘不会要求私下转账。",
      },
      {
        type: "薪资模糊",
        severity: "medium",
        detail: "薪资写「待遇优厚、上不封顶」但无具体区间，且要求与「高薪急聘」强绑定。",
      },
    ],
  };
}

export const POST = handler(async (req) => {
  // 免登录端点：按 IP 限流，防刷爆 AI 成本（10 次/分钟）
  if (ipRateLimited(`scam:${clientIp(req)}`, 10, 60_000)) {
    throw new ApiError(429, "rate_limited", "请求过于频繁，请稍后再试");
  }
  const { text } = await parseBody(req, bodySchema);

  // 无 AI Key 时返回演示样例，保证前端可预览完整交互（明确标注 mock）。
  if (process.env.AI_PROVIDER === "mock" || (!process.env.DEEPSEEK_API_KEY && !process.env.OPENAI_API_KEY)) {
    return ok({ ...sampleScamResult(), model: "mock" });
  }

  const res = await chat({ system: SYSTEM_PROMPT, user: text, json: true, temperature: 0.1 });

  let parsed: Partial<ScamResult>;
  try {
    parsed = JSON.parse(res.content) as Partial<ScamResult>;
  } catch {
    throw new Error("AI 返回内容不是合法 JSON");
  }

  const result: ScamResult = {
    riskLevel: parsed.riskLevel ?? "safe",
    summary: parsed.summary ?? "",
    flags: Array.isArray(parsed.flags) ? parsed.flags : [],
  };

  return ok({ ...result, model: res.model });
});
