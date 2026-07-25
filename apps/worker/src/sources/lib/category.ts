// 岗位品类分类器（可复用、可扩展）。
// 通过关键词规则把一段文本（岗位标题+公司+地点+摘要）映射到品类标签。
// 未来新增品类（如 finance 金融 / medical 医疗 / …）只需：
//   1) 在 RULES 增加一条正则；
//   2) 把品类 id 加进 JOB_CATEGORY_IDS；
//   3) 在 i18n 增加 category.<id> 文案。
// 其它代码（适配器、匹配、UI）无需改动。

export type JobCategory = "game" | "finance" | "tech" | "general";

/** 需要匹配的「具体品类」（不含 general 兜底）。 */
export const JOB_CATEGORY_IDS: Exclude<JobCategory, "general">[] = ["game", "finance", "tech"];

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
  general: "General",
};
