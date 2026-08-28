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

// 单次调用超时（毫秒）。deepseek-v4-pro 处理长文档 JSON 抽取可能超过 2 分钟，默认放宽到 5 分钟，可用 AI_TIMEOUT_MS 覆盖。
const AI_TIMEOUT_MS = Number(process.env.AI_TIMEOUT_MS) || 300_000;

function isTimeoutError(err: unknown): boolean {
  const e = err as { name?: string; cause?: { name?: string } };
  return e?.name === "TimeoutError" || e?.name === "AbortError" || e?.cause?.name === "TimeoutError";
}

export async function chat(opts: ChatOptions): Promise<ChatResult> {
  const provider = resolveProvider();
  if (provider.name === "mock") return mockChat(opts);

  const { baseUrl, apiKey, model, name } = provider as ProviderConfig;
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

// mock：按任务返回结构合法的占位数据，用于无 key 联调整条管线。
// 通过 system prompt 中的标记识别任务类型。
function mockChat(opts: ChatOptions): ChatResult {
  const text = opts.user;
  let result: unknown;

  if (opts.system.includes("简历结构化抽取")) {
    const emailMatch = text.match(/[\w.+-]+@[\w-]+\.[\w.]+/);
    result = {
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
  } else if (opts.system.includes("JD 结构化解析")) {
    // mock 技能提取："精通/熟悉/擅长 X" 的宾语 + 大写英文词（SQL/Tableau），有真实区分度
    const zhSkills = [...text.matchAll(/(?:精通|熟悉|擅长)([一-龥A-Za-z]{2,10})/g)].map((m) => m[1]);
    const enSkills = [...new Set(text.match(/\b[A-Z][A-Za-z]{1,15}\b/g) ?? [])].filter(
      (w) => !["JD", "JLPT", "Manager", "KOL"].includes(w),
    );
    const skills = [...new Set([...zhSkills, ...enSkills])].slice(0, 8);
    // 经验要求：任职要求段落中含"经验"的行
    const expLines = text.split("\n").filter((l) => l.includes("经验")).map((l) => l.replace(/^[-•\s]+/, "").trim());
    const mockLang = /[A-Za-z]/.test(text) && (text.match(/[一-鿿]/g)?.length ?? 0) < 8 ? "en" : "zh";
    result = {
      lang: mockLang,
      company: text.match(/【(.{2,30}?)】/)?.[1] ?? null,
      title: null,
      skills: skills.map((name, i) => ({ name, required: i < 4, weight: i < 4 ? 4 : 2 })),
      experience: expLines.slice(0, 3).map((desc) => ({ desc, yearsMin: Number(desc.match(/(\d+)\s*年/)?.[1]) || null })),
      industry: text.match(/行业[:：]\s*(.+)/)?.[1]?.split(/[/／、\s]+/).filter(Boolean).slice(0, 4) ?? [],
      keywords: skills.slice(0, 5),
      languages: [],
      seniority: null,
      location: null,
      salaryRange: null,
    };
  } else if (opts.system.includes("工作日志")) {
    // 从提示词的"已有技能表"中挑出现于日志正文的技能，模拟建议
    const skillLine = text.match(/已有技能表：(.+)/)?.[1] ?? "";
    const existing = skillLine.split("、").map((s) => s.trim()).filter((s) => s && s !== "（空）");
    const body = text.split("工作日志")[1] ?? text;
    const suggestedSkills = existing.filter((s) => body.includes(s)).slice(0, 3);
    result = {
      summary: `（mock 摘要）${(body.split("：\n")[1] ?? body).replace(/\s+/g, " ").trim().slice(0, 60)}…`,
      suggestedSkills,
      suggestedProjects: [],
    };
  } else if (opts.system.includes("职业画像")) {
    result = {
      headline: "Mock 画像（请配置 AI Key）",
      summary: "这是 mock provider 生成的画像占位。配置 DEEPSEEK_API_KEY 或 OPENAI_API_KEY 后重新生成。",
      careerTags: ["mock"],
      careerLevel: "mid",
      yearsExperience: 5,
      industryTags: [],
    };
  } else {
    result = { note: "mock provider：未识别的任务类型" };
  }

  return { content: JSON.stringify(result), model: "mock", tokensIn: 0, tokensOut: 0 };
}
