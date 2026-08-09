import { z } from "zod";

// 岗位监测契约。来源清单与 worker 的适配器注册表保持一致（新增来源需同步这里）。

// 品类：用于用户端「品类匹配」可选开关。新增品类见 sources/lib/category.ts。
// 一级品类下挂二级细分（subcategories）——发布岗可同时选一级与二级，二级 id 以一级 id 为前缀。
// 存储时一级与二级并存，保证候选端按一级筛选（jobs/active、monitor）仍能命中（见 job-postings.ts 注释）。
export const JOB_CATEGORIES = [
  {
    id: "game",
    label: "游戏类",
    subcategories: [
      { id: "game_client", label: "客户端开发" },
      { id: "game_server", label: "服务端开发" },
      { id: "game_art", label: "美术 · 特效" },
      { id: "game_design", label: "策划 · 设计" },
      { id: "game_techart", label: "技术美术" },
      { id: "game_qa", label: "测试 · QA" },
      { id: "game_ops", label: "运营 · 发行" },
      { id: "game_producer", label: "制作人 · PM" },
    ],
  },
  {
    id: "finance",
    label: "金融类",
    subcategories: [
      { id: "fin_quant", label: "量化研究" },
      { id: "fin_trading", label: "交易 · 做市" },
      { id: "fin_risk", label: "风控 · 合规" },
      { id: "fin_product", label: "金融产品" },
      { id: "fin_data", label: "金融数据 · 分析" },
      { id: "fin_ops", label: "运营 · 客户" },
      { id: "fin_sales", label: "机构销售" },
    ],
  },
  {
    id: "tech",
    label: "技术类",
    subcategories: [
      { id: "tech_frontend", label: "前端" },
      { id: "tech_backend", label: "后端" },
      { id: "tech_fullstack", label: "全栈" },
      { id: "tech_mobile", label: "移动端" },
      { id: "tech_infra", label: "基础架构 · SRE" },
      { id: "tech_data", label: "数据工程" },
      { id: "tech_security", label: "安全" },
      { id: "tech_qa", label: "测试 · 质量" },
      { id: "tech_pm", label: "技术项目管理" },
    ],
  },
  {
    id: "ai",
    label: "AI类",
    subcategories: [
      { id: "ai_research", label: "算法 · 研究" },
      { id: "ai_mleng", label: "机器学习工程" },
      { id: "ai_llm", label: "大模型 · LLM" },
      { id: "ai_data", label: "数据 · 标注" },
      { id: "ai_product", label: "AI 产品" },
      { id: "ai_infra", label: "AI 基础设施" },
      { id: "ai_agent", label: "智能体 · 应用" },
    ],
  },
] as const;

/** 一级品类 id 列表（game / finance / tech / ai）。 */
export const JOB_CATEGORY_IDS = JOB_CATEGORIES.map((c) => c.id) as string[];
/** 全部二级细分 id 列表。 */
export const JOB_SUBCATEGORY_IDS = JOB_CATEGORIES.flatMap((c) =>
  c.subcategories.map((s) => s.id),
) as string[];
/** 所有合法品类 id（一级 + 二级），用于表单校验。 */
export const ALL_CATEGORY_IDS = [...JOB_CATEGORY_IDS, ...JOB_SUBCATEGORY_IDS] as string[];
/** 一级 id → 其下二级 id 集合，便于表单「取消一级时连带清空二级」。 */
export const SUBCATEGORY_IDS_BY_PARENT: Record<string, string[]> = Object.fromEntries(
  JOB_CATEGORIES.map((c) => [c.id, c.subcategories.map((s) => s.id)]),
);
/** id（一级或二级）→ 展示标签，统一给表单 / 候选卡片 / 组织主页用，避免散落 i18n key。 */
export const CATEGORY_LABEL: Record<string, string> = Object.fromEntries([
  ...JOB_CATEGORIES.map((c) => [c.id, c.label] as const),
  ...JOB_CATEGORIES.flatMap((c) => c.subcategories.map((s) => [s.id, s.label] as const)),
]) as Record<string, string>;

// 一个来源可归属多个业态（industries 数组），筛选时命中任意一个即算匹配。
// 例如腾讯/字节同时有互联网与游戏业务，选「游戏」也应出现。
export const WATCH_SOURCES = [
  // 中国互联网 / 大厂（多业态）
  { id: "tencent", label: "腾讯招聘", region: "china", industries: ["internet", "game", "finance"] },
  { id: "bytedance", label: "字节跳动招聘", region: "china", industries: ["internet", "game"] },
  { id: "netease", label: "网易游戏", region: "china", industries: ["game", "internet"] },
  { id: "mihoyo", label: "米哈游", region: "china", industries: ["game"] },
  { id: "liepin", label: "猎聘", region: "china", industries: ["general"] },
  { id: "boss", label: "BOSS直聘", region: "china", industries: ["general"] },
  // 中国金融
  { id: "pingan", label: "中国平安", region: "china", industries: ["finance"] },
  { id: "efund", label: "易方达基金", region: "china", industries: ["finance"] },
  { id: "cmb", label: "招商银行", region: "china", industries: ["finance"] },
  // 日本科技 / 游戏
  { id: "green", label: "Green", region: "japan", industries: ["tech"] },
  { id: "wantedly", label: "Wantedly", region: "japan", industries: ["tech"] },
  { id: "nintendo", label: "Nintendo", region: "japan", industries: ["game"] },
  { id: "bandainamco", label: "万代南梦宫", region: "japan", industries: ["game"] },
  // 美国游戏
  { id: "riotgames", label: "Riot Games", region: "usa", industries: ["game"] },
  { id: "scopely", label: "Scopely", region: "usa", industries: ["game"] },
  { id: "epicgames", label: "Epic Games", region: "usa", industries: ["game"] },
  { id: "taketwo", label: "Take-Two Interactive", region: "usa", industries: ["game"] },
  { id: "bungie", label: "Bungie", region: "usa", industries: ["game"] },
  { id: "bethesda", label: "Bethesda", region: "usa", industries: ["game"] },
  // 美国金融：银行 / 数字银行 / 借贷 / 保险 / 券商 / 支付
  { id: "sofi", label: "SoFi", region: "usa", industries: ["finance"] },
  { id: "brex", label: "Brex", region: "usa", industries: ["finance"] },
  { id: "chime", label: "Chime", region: "usa", industries: ["finance"] },
  { id: "upgrade", label: "Upgrade", region: "usa", industries: ["finance"] },
  { id: "affirm", label: "Affirm", region: "usa", industries: ["finance"] },
  { id: "mercury", label: "Mercury", region: "usa", industries: ["finance"] },
  { id: "coinbase", label: "Coinbase", region: "usa", industries: ["finance"] },
  { id: "oscar", label: "Oscar Health", region: "usa", industries: ["finance"] },
  { id: "ethos", label: "Ethos", region: "usa", industries: ["finance"] },
  { id: "point72", label: "Point72", region: "usa", industries: ["finance"] },
  { id: "robinhood", label: "Robinhood", region: "usa", industries: ["finance"] },
  { id: "virtu", label: "Virtu Financial", region: "usa", industries: ["finance"] },
  { id: "schonfeld", label: "Schonfeld", region: "usa", industries: ["finance"] },
  { id: "exoduspoint", label: "ExodusPoint", region: "usa", industries: ["finance"] },
  { id: "payoneer", label: "Payoneer", region: "usa", industries: ["finance"] },
  // 英国金融
  { id: "monzo", label: "Monzo", region: "uk", industries: ["finance"] },
  { id: "tide", label: "Tide", region: "uk", industries: ["finance"] },
  { id: "winton", label: "Winton", region: "uk", industries: ["finance"] },
  { id: "mangroup", label: "Man Group", region: "uk", industries: ["finance"] },
  // 其它国家游戏
  { id: "krafton", label: "Krafton", region: "other", industries: ["game"] },
  { id: "nordeus", label: "Nordeus", region: "other", industries: ["game"] },
  { id: "wooga", label: "Wooga", region: "other", industries: ["game"] },
  { id: "remedy", label: "Remedy Entertainment", region: "other", industries: ["game"] },
  { id: "housemarque", label: "Housemarque", region: "other", industries: ["game"] },
  // 其它国家金融
  { id: "n26", label: "N26", region: "other", industries: ["finance"] },
  { id: "adyen", label: "Adyen", region: "other", industries: ["finance"] },
  { id: "imc", label: "IMC", region: "other", industries: ["finance"] },
  { id: "janestreet", label: "Jane Street", region: "other", industries: ["finance"] },
  { id: "jumptrading", label: "Jump Trading", region: "other", industries: ["finance"] },
  { id: "flowtraders", label: "Flow Traders", region: "other", industries: ["finance"] },
  // 全球综合 / 科技招聘平台
  { id: "indeed", label: "Indeed", region: "japan", industries: ["general"] },
  { id: "remoteok", label: "RemoteOK", region: "usa", industries: ["tech"] },
  { id: "hackernews", label: "Hacker News", region: "usa", industries: ["tech"] },
  // 美国科技 / AI / 社交 / 出行 / 电商 / 教育 / 旅游 / 加密（Greenhouse 官方招聘板，实网验证 2026-07-27）
  { id: "stripe", label: "Stripe", region: "usa", industries: ["tech", "finance"] },
  { id: "datadog", label: "Datadog", region: "usa", industries: ["tech"] },
  { id: "figma", label: "Figma", region: "usa", industries: ["tech"] },
  { id: "cloudflare", label: "Cloudflare", region: "usa", industries: ["tech", "security"] },
  { id: "twilio", label: "Twilio", region: "usa", industries: ["tech"] },
  { id: "gitlab", label: "GitLab", region: "usa", industries: ["tech"] },
  { id: "okta", label: "Okta", region: "usa", industries: ["security", "tech"] },
  { id: "zscaler", label: "Zscaler", region: "usa", industries: ["security", "tech"] },
  { id: "mongodb", label: "MongoDB", region: "usa", industries: ["tech"] },
  { id: "databricks", label: "Databricks", region: "usa", industries: ["ai", "tech"] },
  { id: "fastly", label: "Fastly", region: "usa", industries: ["tech"] },
  { id: "anthropic", label: "Anthropic", region: "usa", industries: ["ai"] },
  { id: "discord", label: "Discord", region: "usa", industries: ["social"] },
  { id: "pinterest", label: "Pinterest", region: "usa", industries: ["social"] },
  { id: "reddit", label: "Reddit", region: "usa", industries: ["social"] },
  { id: "twitch", label: "Twitch", region: "usa", industries: ["social"] },
  { id: "lyft", label: "Lyft", region: "usa", industries: ["mobility"] },
  { id: "instacart", label: "Instacart", region: "usa", industries: ["ecommerce"] },
  { id: "gemini", label: "Gemini", region: "usa", industries: ["crypto"] },
  { id: "coursera", label: "Coursera", region: "usa", industries: ["edu"] },
  { id: "duolingo", label: "Duolingo", region: "usa", industries: ["edu"] },
  { id: "airbnb", label: "Airbnb", region: "usa", industries: ["travel"] },
  { id: "tripadvisor", label: "Tripadvisor", region: "usa", industries: ["travel"] },
  // 美国：设计 / 媒体 / 数据库 / 健康 / 气候 / 教育 / 旅游 / 物流 / 数据分析（Greenhouse 官方招聘板，实网验证 2026-07-27）
  { id: "webflow", label: "Webflow", region: "usa", industries: ["design", "tech"] },
  { id: "disney", label: "Disney", region: "usa", industries: ["media"] },
  { id: "cockroachlabs", label: "Cockroach Labs", region: "usa", industries: ["database", "tech"] },
  { id: "planetscale", label: "PlanetScale", region: "usa", industries: ["database", "tech"] },
  { id: "clickhouse", label: "ClickHouse", region: "usa", industries: ["database", "tech"] },
  { id: "peloton", label: "Peloton", region: "usa", industries: ["health"] },
  { id: "oura", label: "Oura", region: "other", industries: ["health"] },
  { id: "calm", label: "Calm", region: "usa", industries: ["health"] },
  { id: "waymo", label: "Waymo", region: "usa", industries: ["mobility", "ai"] },
  { id: "figureai", label: "Figure", region: "usa", industries: ["ai"] },
  { id: "watershed", label: "Watershed", region: "usa", industries: ["climate"] },
  { id: "redwoodmaterials", label: "Redwood Materials", region: "usa", industries: ["climate"] },
  { id: "udemy", label: "Udemy", region: "usa", industries: ["edu"] },
  { id: "udacity", label: "Udacity", region: "usa", industries: ["edu"] },
  { id: "masterclass", label: "MasterClass", region: "usa", industries: ["edu"] },
  { id: "kayak", label: "Kayak", region: "usa", industries: ["travel"] },
  { id: "flexport", label: "Flexport", region: "usa", industries: ["logistics", "ecommerce"] },
  { id: "newrelic", label: "New Relic", region: "usa", industries: ["tech", "analytics"] },
  { id: "honeycomb", label: "Honeycomb", region: "usa", industries: ["tech", "analytics"] },
  { id: "sigmacomputing", label: "Sigma Computing", region: "usa", industries: ["analytics", "database"] },
  { id: "amplitude", label: "Amplitude", region: "usa", industries: ["analytics"] },
  { id: "mixpanel", label: "Mixpanel", region: "usa", industries: ["analytics"] },
  { id: "roblox", label: "Roblox", region: "usa", industries: ["game"] },
  // Lever 招聘板（公开 JSON，无鉴权；实测多数大厂 Lever token 为 404，仅少数可用）
  { id: "spotify", label: "Spotify", region: "usa", industries: ["media"] },
  { id: "binance", label: "Binance", region: "other", industries: ["crypto"] },
  { id: "angellist", label: "AngelList", region: "usa", industries: ["finance"] },
  { id: "theathletic", label: "The Athletic", region: "usa", industries: ["media"] },
  { id: "houzz", label: "Houzz", region: "usa", industries: ["design"] },
] as const;

export type SourceRegion = "china" | "usa" | "japan" | "uk" | "other";
export type SourceIndustry =
  | "internet"
  | "tech"
  | "game"
  | "finance"
  | "general"
  | "ai"
  | "social"
  | "mobility"
  | "ecommerce"
  | "crypto"
  | "edu"
  | "travel"
  | "security"
  | "design"
  | "media"
  | "database"
  | "health"
  | "climate"
  | "logistics"
  | "analytics";

export const SOURCE_REGIONS: { id: SourceRegion; label: string }[] = [
  { id: "china", label: "中国" },
  { id: "usa", label: "美国" },
  { id: "japan", label: "日本" },
  { id: "uk", label: "英国" },
  { id: "other", label: "其它国家" },
];

export const SOURCE_INDUSTRIES: { id: SourceIndustry; label: string }[] = [
  { id: "internet", label: "互联网" },
  { id: "tech", label: "科技" },
  { id: "game", label: "游戏" },
  { id: "finance", label: "金融" },
  { id: "general", label: "综合" },
  { id: "ai", label: "人工智能" },
  { id: "social", label: "社交/内容" },
  { id: "mobility", label: "出行" },
  { id: "ecommerce", label: "电商/零售" },
  { id: "crypto", label: "加密货币" },
  { id: "edu", label: "教育" },
  { id: "travel", label: "旅游" },
  { id: "security", label: "安全" },
  { id: "design", label: "设计/创意" },
  { id: "media", label: "媒体/娱乐" },
  { id: "database", label: "数据库" },
  { id: "health", label: "健康/医疗" },
  { id: "climate", label: "气候/能源" },
  { id: "logistics", label: "物流" },
  { id: "analytics", label: "数据分析" },
];

export const watchSourceIds = WATCH_SOURCES.map((s) => s.id) as [string, ...string[]];

// ============ 细化筛选维度（参考 BOSS 直聘职种树 / Greenhouse 部门分类） ============

// 职种：按品类分组。i18n 文案键 role.<id>。
// 新增职种：这里加一行 + worker taxonomy.ts 加正则 + i18n 加 role.<id>。
export const JOB_ROLES = [
  // 游戏类
  { id: "game_design", category: "game" },
  { id: "game_art", category: "game" },
  { id: "game_client", category: "game" },
  { id: "game_qa", category: "game" },
  { id: "game_ops", category: "game" },
  { id: "game_producer", category: "game" },
  // 金融类
  { id: "fin_quant_research", category: "finance" },
  { id: "fin_quant_trading", category: "finance" },
  { id: "fin_risk", category: "finance" },
  { id: "fin_research", category: "finance" },
  { id: "fin_ibd", category: "finance" },
  { id: "fin_asset", category: "finance" },
  // 技术类
  { id: "tech_backend", category: "tech" },
  { id: "tech_frontend", category: "tech" },
  { id: "tech_mobile", category: "tech" },
  { id: "tech_ai", category: "tech" },
  { id: "tech_data", category: "tech" },
  { id: "tech_qa", category: "tech" },
  { id: "tech_devops", category: "tech" },
  { id: "tech_security", category: "tech" },
  // AI 类
  { id: "ai_llm", category: "ai" },
  { id: "ai_algo", category: "ai" },
  { id: "ai_agent", category: "ai" },
  { id: "ai_cv_nlp", category: "ai" },
  // 通用（跨行业）
  { id: "gen_product", category: "general" },
  { id: "gen_design", category: "general" },
  { id: "gen_ops", category: "general" },
  { id: "gen_marketing", category: "general" },
  { id: "gen_sales", category: "general" },
] as const;

export const jobRoleIds = JOB_ROLES.map((r) => r.id) as [string, ...string[]];

// 地区预设：i18n 文案键 region.<id>。matchRegions 同时接受预设 id 与自定义文本。
export const REGIONS = [
  { id: "beijing", scope: "cn" },
  { id: "shanghai", scope: "cn" },
  { id: "shenzhen", scope: "cn" },
  { id: "guangzhou", scope: "cn" },
  { id: "hangzhou", scope: "cn" },
  { id: "chengdu", scope: "cn" },
  { id: "wuhan", scope: "cn" },
  { id: "usa", scope: "global" },
  { id: "japan", scope: "global" },
  { id: "singapore", scope: "global" },
  { id: "uk", scope: "global" },
  { id: "remote", scope: "global" },
] as const;

export const regionIds = REGIONS.map((r) => r.id) as [string, ...string[]];

// 语言要求：从 JD 文本自动检测。i18n 键 lang.<id>。
export const JOB_LANGUAGES = ["zh", "en", "ja", "ko"] as const;

// 经验级别：从 JD 文本自动检测。i18n 键 exp.<id>。
export const EXPERIENCE_LEVELS = ["junior", "mid", "senior", "lead"] as const;

export const jobWatchInput = z.object({
  name: z.string().min(1).max(120),
  keywords: z.array(z.string().min(1).max(60)).min(1).max(5),
  sources: z.array(z.enum(watchSourceIds)).min(1),
  locations: z.array(z.string().max(40)).max(5).default([]),
  // 品类匹配：非空时只保留命中这些品类的岗位（见 sources/lib/category.ts）
  matchCategories: z.array(z.enum(["game", "finance", "tech", "ai"])).max(4).default([]),
  // 职种匹配：非空时只保留命中职种的岗位（见 sources/lib/taxonomy.ts）
  matchRoles: z.array(z.enum(jobRoleIds)).max(10).default([]),
  // 地区匹配：预设 region id 或自定义文本（对 location 做包含匹配）
  matchRegions: z.array(z.string().min(1).max(40)).max(10).default([]),
  // 语言匹配：JD 语言自动检测后过滤
  matchLanguages: z.array(z.enum(JOB_LANGUAGES)).max(4).default([]),
  // 经验级别匹配：未检测出级别的岗位不过滤（视为未知，保留）
  matchExperience: z.array(z.enum(EXPERIENCE_LEVELS)).max(4).default([]),
  // 硬门槛（确定性丢弃）：title/snippet 命中任一排除词即丢弃（如 外包/派遣/实习/兼职）
  excludeKeywords: z.array(z.string().min(1).max(40)).max(20).default([]),
  // 硬门槛：陈旧过滤，publishedAt 超过 N 天丢弃；不设或无发布时间则不过滤
  maxAgeDays: z.number().int().min(1).max(365).nullable().optional(),
  intervalMinutes: z.number().int().min(30).max(24 * 60).default(60),
  enabled: z.boolean().default(true),
});

export type JobWatchInput = z.infer<typeof jobWatchInput>;

export const discoveredJobStatusInput = z.object({
  status: z.enum(["viewed", "dismissed"]),
});
