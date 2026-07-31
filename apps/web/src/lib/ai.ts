// Web 端本地的 AI Gateway 客户端，逻辑与 apps/worker/src/ai/provider.ts 保持一致的
// DeepSeek / OpenAI 兼容 Chat Completions 封装。P0 公开工具（/api/tools/*）直接复用，
// 无需经 Redis/worker 队列。Provider 选择顺序：AI_PROVIDER 显式 > deepseek（有 key）> openai（有 key）> mock。

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
  model?: string; // 覆盖默认模型（如创作类任务用更快的 deepseek-chat 而非推理模型）
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

// 单次调用超时（毫秒）。长文档 JSON 抽取可能较慢，默认放宽到 5 分钟，可用 AI_TIMEOUT_MS 覆盖。
const AI_TIMEOUT_MS = Number(process.env.AI_TIMEOUT_MS) || 300_000;

function isTimeoutError(err: unknown): boolean {
  const e = err as { name?: string; cause?: { name?: string } };
  return e?.name === "TimeoutError" || e?.name === "AbortError" || e?.cause?.name === "TimeoutError";
}

export async function chat(opts: ChatOptions): Promise<ChatResult> {
  const provider = resolveProvider();
  if (provider.name === "mock") return mockChat(opts);

  const { baseUrl, apiKey, name } = provider as ProviderConfig;
  // 允许按调用覆盖模型（仅对 deepseek 生效，避免把 deepseek 专属型号传给 openai）
  const model = name === "deepseek" && opts.model ? opts.model : (provider as ProviderConfig).model;
  if (!apiKey) throw new Error(`AI 提供商 ${name} 未配置 API Key`);

  const doFetch = () =>
    fetch(`${baseUrl}/chat/completions`, {
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
      signal: AbortSignal.timeout(AI_TIMEOUT_MS),
    });

  let res: Response;
  try {
    res = await doFetch();
  } catch (err) {
    if (!isTimeoutError(err)) throw err;
    // 超时自动重试一次（网关/模型偶发慢响应）
    console.warn(`[ai] ${name}/${model} 调用超时（${AI_TIMEOUT_MS}ms），自动重试一次…`);
    res = await doFetch();
  }

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

// mock：返回结构合法的占位 JSON，并打上 mock 标记，便于无 key 联调时前端识别「演示模式」。
function mockChat(_opts: ChatOptions): ChatResult {
  return {
    content: JSON.stringify({ mock: true, note: "未配置 AI Key，返回模拟数据（演示模式）" }),
    model: "mock",
    tokensIn: 0,
    tokensOut: 0,
  };
}
