// 岗位品类分类器（可复用、可扩展）。
// 通过关键词规则把一段文本（岗位标题+公司+地点+摘要）映射到品类标签。
// 未来新增品类（如 finance 金融 / medical 医疗 / …）只需：
//   1) 在 RULES 增加一条正则；
//   2) 把品类 id 加进 JOB_CATEGORY_IDS；
//   3) 在 i18n 增加 category.<id> 文案。
// 其它代码（适配器、匹配、UI）无需改动。

export type JobCategory = "game" | "finance" | "tech" | "ai" | "general";

/** 需要匹配的「具体品类」（不含 general 兜底）。 */
export const JOB_CATEGORY_IDS: Exclude<JobCategory, "general">[] = ["game", "finance", "tech", "ai"];

const RULES: Record<Exclude<JobCategory, "general">, RegExp> = {
  // 游戏类：覆盖厂商名、产品名、引擎、岗位类型
  game:
    /游戏|手游|网游|原神|崩坏|星穹铁道|绝区零|米哈游|网易游戏|腾讯游戏|unity|unreal|虚幻|游戏引擎|game\s?design|level\s?design|gameplay|gamification|关卡|数值策划|游戏策划|concept\s?artist|game\s?artist|world\s?build/i,
  // 金融类
  finance:
    /金融|量化|交易|投行|证券|基金|风控|financ|trading|invest|quant|bank|asset\s?management|wealth/i,
  // 技术类（通用研发）
  tech:
    /engineer|工程师|后端|前端|全栈|算法|data\s?scientist|software|sde|开发|编程|devops|sre|机器学习/i,
  // AI 类：大模型 / 生成式 AI / LLM / Agent / 具身智能 / CV / NLP / 多模态 / 深度学习 / 强化学习
  ai:
    /artificial\s?intelligence|\bai\b|\baigc\b|llm|large\s?language\s?model|slm|small\s?language\s?model|genai|generative\s?ai|gpt|claude|deepseek|qwen|llama|rag|transformer|prompt\s?engineer|prompt\s?工程|agent|智能体|多智能体|multi\s?agent|auto\s?gpt|数字员工|智能助手|大模型|基座模型|基模|预训练|sft|rlhf|对齐|lora|大语言模型|生成式|aigc|文生图|图生文|text\s?to\s?image|image\s?to\s?text|diffusion|stable\s?diffusion|自然语言处理|nlp|计算机视觉|cv(?!\s?写作)|视觉大模型|视觉语言模型|vlm|clip|ocr|图像识别|视频理解|语音识别|speech\s?recognition|asr|tts|语音合成|多模态|multimodal|深度学习|deep\s?learning|强化学习|reinforcement\s?learning|rl\b|具身智能|embodied\s?ai|vla|machine\s?learning|\bml\b|推荐算法|搜索算法|广告算法|排序算法|图神经网络|gnn|联邦学习|迁移学习/i,
};

/** 文本 → 品类标签数组（无命中返回 ["general"]）。 */
export function classifyCategories(text: string): JobCategory[] {
  const lower = text.toLowerCase();
  const hits = JOB_CATEGORY_IDS.filter((c) => RULES[c].test(lower));
  return hits.length ? hits : ["general"];
}

/** 合并「来源品类亲和（如游戏厂默认游戏类）」与「文本分类」，去重。 */
export function deriveCategories(text: string, sourceCategory?: JobCategory): JobCategory[] {
  const set = new Set<JobCategory>(classifyCategories(text));
  if (sourceCategory) set.add(sourceCategory);
  return [...set];
}

/** 非 i18n 场景的英文回退标签（适配器日志/调试用）。 */
export const CATEGORY_LABEL_FALLBACK: Record<JobCategory, string> = {
  game: "Game",
  finance: "Finance",
  tech: "Tech",
  ai: "AI",
  general: "General",
};
