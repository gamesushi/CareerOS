// AI Gateway 的 provider 层：统一 OpenAI 兼容 Chat Completions 接口。
// 选择顺序：AI_PROVIDER 显式指定 > deepseek（有 key）> openai（有 key）> mock（警告）。

export type ChatResult = {
  content: string;
  model: string;
  tokensIn: number;
  tokensOut: number;
};

export type ChatOptions = {
  system: string;
  user: string;
  json?: boolean;
  temperature?: number;
};

type ProviderConfig = { name: string; baseUrl: string; apiKey: string; model: string };

function resolveProvider(): ProviderConfig | { name: "mock" } {
  const forced = process.env.AI_PROVIDER;
  const deepseek: ProviderConfig = {
    name: "deepseek",
    baseUrl: "https://api.deepseek.com/v1",
    apiKey: process.env.DEEPSEEK_API_KEY ?? "",
    model: process.env.DEEPSEEK_MODEL ?? "deepseek-chat",
  };
  const openai: ProviderConfig = {
    name: "openai",
    baseUrl: process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1",
    apiKey: process.env.OPENAI_API_KEY ?? "",
    model: process.env.OPENAI_MODEL ?? "gpt-4.1-mini",
  };
  if (forced === "mock") return { name: "mock" };
  if (forced === "deepseek") return deepseek;
  if (forced === "openai") return openai;
  if (deepseek.apiKey) return deepseek;
  if (openai.apiKey) return openai;
  console.warn("[ai] 未配置任何 AI 提供商密钥，使用 mock provider（仅供联调）");
  return { name: "mock" };
}

export async function chat(opts: ChatOptions): Promise<ChatResult> {
  const provider = resolveProvider();
  if (provider.name === "mock") return mockChat(opts);

  const { baseUrl, apiKey, model, name } = provider as ProviderConfig;
  if (!apiKey) throw new Error(`AI 提供商 ${name} 未配置 API Key`);

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: opts.system },
        { role: "user", content: opts.user },
      ],
      temperature: opts.temperature ?? 0.1,
      ...(opts.json ? { response_format: { type: "json_object" } } : {}),
    }),
    signal: AbortSignal.timeout(110_000),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`AI 调用失败 ${name}/${model} HTTP ${res.status}: ${body.slice(0, 300)}`);
  }
  const data = (await res.json()) as {
    choices: { message: { content: string } }[];
    usage?: { prompt_tokens?: number; completion_tokens?: number };
    model?: string;
  };
  return {
    content: data.choices[0]?.message?.content ?? "",
    model: data.model ?? model,
    tokensIn: data.usage?.prompt_tokens ?? 0,
    tokensOut: data.usage?.completion_tokens ?? 0,
  };
}

// mock：从原文里粗提一个可信的固定结构，用于无 key 联调整条管线
function mockChat(opts: ChatOptions): ChatResult {
  const text = opts.user;
  const emailMatch = text.match(/[\w.+-]+@[\w-]+\.[\w.]+/);
  const result = {
    basics: { name: null, email: emailMatch?.[0] ?? null, phone: null, location: null, links: [], summary: null },
    experiences: [
      {
        company: "Mock 株式会社",
        title: "Mock 抽取的职位（请配置 AI Key 获得真实结果）",
        startDate: "2022-01",
        endDate: null,
        location: null,
        description: text.slice(0, 120),
        highlights: ["这是 mock provider 生成的占位数据"],
        confidence: "low",
      },
    ],
    projects: [],
    skills: [{ name: "Mock技能", category: "domain", evidenceHint: null }],
    achievements: [],
    educations: [],
  };
  return { content: JSON.stringify(result), model: "mock", tokensIn: 0, tokensOut: 0 };
}
