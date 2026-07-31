// 岗位细化标签引擎：职种 / 地区 / 语言 / 经验级别。
// 与 category.ts（大类）互补：category 粗筛品类，taxonomy 细化到职种等维度。
// 派生统一发生在 watchPoll（中央），适配器无需改动。
// 新增职种：shared/watch.ts JOB_ROLES 加一行 + 这里 ROLE_RULES 加正则 + i18n 加 role.<id>。

export type RoleId =
  | "game_design" | "game_art" | "game_client" | "game_qa" | "game_ops" | "game_producer"
  | "fin_quant_research" | "fin_quant_trading" | "fin_risk" | "fin_research" | "fin_ibd" | "fin_asset"
  | "tech_backend" | "tech_frontend" | "tech_mobile" | "tech_ai" | "tech_data" | "tech_qa"
  | "tech_devops" | "tech_security"
  | "ai_llm" | "ai_algo" | "ai_agent" | "ai_cv_nlp"
  | "gen_product" | "gen_design" | "gen_ops" | "gen_marketing" | "gen_sales";

export type RegionId =
  | "beijing" | "shanghai" | "shenzhen" | "guangzhou" | "hangzhou" | "chengdu" | "wuhan"
  | "usa" | "japan" | "singapore" | "uk" | "remote";

export type LangId = "zh" | "en" | "ja" | "ko";
export type ExpLevel = "junior" | "mid" | "senior" | "lead";

// ---------- 职种规则（顺序即优先级；一个岗位可命中多个职种） ----------
const ROLE_RULES: Record<RoleId, RegExp> = {
  // 游戏
  game_design:
    /游戏策划|数值策划|关卡策划|系统策划|剧情策划|文案策划|战斗策划|game\s?design|level\s?design|narrative\s?design|quest\s?design|systems?\s?design(?=.*game)|combat\s?design|ゲーム(プランナー|デザイナー)|レベルデザイ|シナリオライター/i,
  game_art:
    /游戏美术|原画|角色美术|场景美术|特效美术|动作设计|技术美术|(2d|3d)\s?(artist|animator|アーティスト)|concept\s?art|character\s?art|environment\s?art|vfx\s?artist|technical\s?artist|animator|texture|rigging|アーティスト|イラストレーター|キャラクターデザイ|背景デザイ|モデラー|アニメーター/i,
  game_client:
    /游戏(客户端|服务端|服务器|引擎)|unity|unreal|虚幻|cocos|gameplay\s?(engineer|programmer)|game\s?(engineer|programmer|developer)|engine\s?(engineer|programmer)|graphics\s?(engineer|programmer)|shader|渲染/i,
  game_qa:
    /游戏测试|game\s?(qa|test)|qa\s?(tester|analyst)(?=.*game)|playtest/i,
  game_ops:
    /游戏运营|游戏发行|liveops|live\s?ops|community\s?manager|发行运营|本地化运营/i,
  game_producer:
    /制作人|游戏项目管理|producer|production\s?(director|manager)|scrum\s?master(?=.*game)/i,
  // 金融
  fin_quant_research:
    /量化研究|quant(itative)?\s?research|alpha\s?research|因子|策略研究(?=.*量化)?|research\s?scientist(?=.*(quant|trading|finance))/i,
  fin_quant_trading:
    /量化交易|quant(itative)?\s?(trader|trading)|高频交易|hft|algo(rithmic)?\s?trad|systematic\s?trad|market\s?mak|execution\s?trad|prop(rietary)?\s?trad/i,
  fin_risk:
    /风控|风险管理|风险控制|risk\s?(management|manager|analyst|officer|control)|credit\s?risk|market\s?risk|合规|compliance|aml|kyc|反洗钱/i,
  fin_research:
    /行业研究|行研|投研|证券分析|equity\s?research|sell.?side\s?(analyst|research)|buy.?side\s?(analyst|research)|investment\s?(analyst|research)|macro\s?(analyst|research)/i,
  fin_ibd:
    /投行|投资银行|ibd|investment\s?bank|m&a|并购|承销|underwrit|capital\s?markets|ecm|dcm|sponsor/i,
  fin_asset:
    /资产管理|资管|基金经理|组合管理|asset\s?management|portfolio\s?manager|wealth\s?management|fund\s?manager|财富管理/i,
  // 技术
  tech_backend:
    /后端|服务端(?!.*游戏)|backend|back.?end|server.?side|java\s?(developer|engineer)|golang|node\.?js|微服务|分布式/i,
  tech_frontend:
    /前端|frontend|front.?end|web\s?developer|react|vue|angular|typescript(?=.*(前端|frontend|web))/i,
  tech_mobile:
    /移动端|客户端(?!.*游戏)|ios|android|flutter|react\s?native|mobile\s?(developer|engineer)|swift|kotlin/i,
  // 技术类通用算法/AI：兜底非 LLM/Agent/CV-NLP 的算法岗位；细分方向由 AI 类职种覆盖
  tech_ai:
    /data\s?scientist|推荐系统|搜索算法|广告算法|排序算法|召回算法|风控算法|图算法|知识图谱|数据挖掘|预测模型|时间序列|machine\s?learning|\bml\b|深度学习|deep\s?learning|算法工程|算法专家|算法研究员|算法开发|算法岗|算法科学家/i,
  tech_data:
    /数据工程|数据开发|数据仓库|数仓|data\s?(engineer|platform|infra)|etl|spark|flink|hadoop|大数据/i,
  tech_qa:
    /(?<!游戏)测试(工程师|开发)?|软件测试|自动化测试|\bqa\b(?!.*game)|sdet|quality\s?(assurance|engineer)|test\s?engineer/i,
  tech_devops:
    /运维|devops|\bsre\b|site\s?reliability|平台工程|platform\s?engineer|infra(structure)?\s?engineer|kubernetes|k8s|云原生|cloud\s?engineer/i,
  tech_security:
    /安全(工程师|研究|专家|开发)|渗透测试|security\s?(engineer|analyst|research)|appsec|infosec|penetration|红队|蓝队|漏洞/i,
  // AI 类（按方向细分；一个岗位可同时命中多个 AI 职种）
  ai_llm:
    /大模型|大语言模型|llm|large\s?language\s?model|slm|small\s?language\s?model|基座模型|基模|foundation\s?model|rag|transformer|bert|gpt|claude|deepseek|qwen|llama|gemini|prompt\s?engineer|prompt\s?工程|提示词工程|提示工程|预训练|pre-?train|sft|supervised\s?fine-?tuning|rlhf|人类反馈|对齐|alignment|lora|全参数微调|peft|指令微调|instruction\s?tuning|模型蒸馏|model\s?distillation|post-?train|多轮对话|对话系统|chatbot|对话大模型|生成式|generative\s?ai|aigc|llmops/i,
  ai_algo:
    /算法工程师|算法专家|机器学习|machine\s?learning|\bml\b|深度学习|deep\s?learning|强化学习|reinforcement\s?learning|\brl\b|推荐算法|搜索算法|广告算法|排序算法|召回算法|风控算法|营销算法|定价算法|调度算法|图算法|图神经网络|\bgnn\b|知识图谱|联邦学习|迁移学习|元学习|半监督|无监督|自监督|表征学习|度量学习|数据挖掘|预测模型|时间序列|计算机视觉(?!.*多模态)|nlp(?!.*多模态)|自然语言处理(?!.*多模态)/i,
  ai_agent:
    /智能体|agent|multi\s?agent|多智能体|auto\s?gpt|autogpt|智能助手|数字员工|ai\s?worker|agentic|re-act|react\s?agent|工具调用|function\s?calling|具身智能|embodied\s?ai|embodied\s?intelligence|vla|vision\s?language\s?action|机器人大脑|robot\s?learning|认知架构|cognitive\s?architecture|规划与执行|plan\s?and\s?execute|swarm/i,
  ai_cv_nlp:
    /计算机视觉|\bcv\b(?!\s?写作)|视觉大模型|视觉语言模型|\bvlm\b|clip|ocr|图像识别|目标检测|图像分割|图像生成|文生图|text\s?to\s?image|图生文|image\s?to\s?text|diffusion|stable\s?diffusion|midjourney|视频理解|视频生成|多模态|multimodal|multimodal\s?llm|自然语言处理|\bnlp\b|文本生成|文本理解|命名实体识别|ner|情感分析|机器翻译|问答系统|语音识别|speech\s?recognition|\basr\b|tts|text\s?to\s?speech|语音合成|声纹识别|speaker\s?recognition|语音大模型/i,
  // 通用
  gen_product:
    /产品经理|产品负责人|product\s?(manager|owner|lead)|\bpm\b(?!.*(project|program))|产品策划(?!.*游戏)/i,
  gen_design:
    /ui|ux|交互设计|视觉设计|用户体验|product\s?design|interaction\s?design|visual\s?design|界面设计/i,
  gen_ops:
    /(?<!游戏)运营(?!维)|用户运营|内容运营|活动运营|社区运营|电商运营|operations?\s?(manager|specialist)(?!.*game)/i,
  gen_marketing:
    /市场|品牌|营销|推广|增长|marketing|brand|growth|seo|sem|广告投放|投放优化/i,
  gen_sales:
    /销售|商务|客户经理|大客户|sales|business\s?develop|\bbd\b|account\s?(manager|executive)|渠道/i,
};

export const ROLE_IDS = Object.keys(ROLE_RULES) as RoleId[];

/** 文本 → 职种标签（可多个；无命中返回 []）。 */
export function classifyRoles(text: string): RoleId[] {
  return ROLE_IDS.filter((r) => ROLE_RULES[r].test(text));
}

// ---------- 地区归一化 ----------
const REGION_RULES: Record<RegionId, RegExp> = {
  beijing: /北京|beijing|peking/i,
  shanghai: /上海|shanghai/i,
  shenzhen: /深圳|shenzhen/i,
  guangzhou: /广州|guangzhou|canton/i,
  hangzhou: /杭州|hangzhou/i,
  chengdu: /成都|chengdu/i,
  wuhan: /武汉|wuhan/i,
  usa: /美国|united\s?states|\busa?\b|\bu\.s\.?\b|new\s?york|san\s?francisco|seattle|los\s?angeles|boston|chicago|austin|加州|纽约|西雅图|, (ny|ca|wa|tx|ma|il)\b/i,
  japan: /日本|japan|tokyo|osaka|kyoto|东京|東京|大阪|京都|横滨|横浜|yokohama|福冈|福岡|fukuoka|名古屋|nagoya/i,
  singapore: /新加坡|singapore/i,
  uk: /英国|united\s?kingdom|\buk\b|london|伦敦|manchester|edinburgh/i,
  remote: /远程|在宅|remote|work\s?from\s?home|wfh|リモート|distributed|anywhere/i,
};

export const REGION_IDS = Object.keys(REGION_RULES) as RegionId[];

/** location/文本 → 预设地区标签（可多个；无命中返回 []）。 */
export function classifyRegions(text: string): RegionId[] {
  return REGION_IDS.filter((r) => REGION_RULES[r].test(text));
}

// ---------- 语言检测 ----------
// JD 主体语言（按字符集）+ 显式语言要求（"英语流利" / "N1" 等）。
export function detectLanguages(text: string): LangId[] {
  const langs = new Set<LangId>();
  const cjk = (text.match(/[\u4e00-\u9fff]/g) ?? []).length;
  const kana = (text.match(/[\u3040-\u30ff]/g) ?? []).length;
  const hangul = (text.match(/[\uac00-\ud7af]/g) ?? []).length;
  const latin = (text.match(/[a-zA-Z]/g) ?? []).length;
  if (kana > 5) langs.add("ja");
  else if (cjk > 5) langs.add("zh");
  if (hangul > 5) langs.add("ko");
  if (latin > Math.max(cjk, kana, hangul) * 2 && latin > 20) langs.add("en");
  // 显式语言要求
  if (/英语|英文|english\s?(fluent|proficien|required|business)|fluent\s?(in\s?)?english|toeic|雅思|托福/i.test(text)) langs.add("en");
  if (/日语|日文|japanese|\bn[12]\b|jlpt|日本語/i.test(text)) langs.add("ja");
  if (/韩语|korean|한국어|topik/i.test(text)) langs.add("ko");
  if (/中文|汉语|普通话|mandarin|chinese\s?(fluent|native|required)|hsk/i.test(text)) langs.add("zh");
  return [...langs];
}

// ---------- 经验级别检测 ----------
// 返回可多个（如 "3-5年" 同时覆盖 mid）。未检出返回 []（匹配时视为未知、不过滤）。
export function detectExperience(text: string): ExpLevel[] {
  const levels = new Set<ExpLevel>();
  // 管理/负责人
  if (/总监|负责人|主管|经理(?!助理)|director|head\s?of|\bvp\b|manager(?!.*account)|leader?ship|团队管理|带团队/i.test(text)) {
    levels.add("lead");
  }
  // 资深关键词
  if (/资深|高级|专家|senior|staff|principal|expert|\bsr\.?\b/i.test(text)) levels.add("senior");
  // 初级关键词
  if (/初级|应届|校招|实习|junior|intern|entry.?level|graduate|new\s?grad|无经验|经验不限/i.test(text)) {
    levels.add("junior");
  }
  // 年限区间："3-5年" / "5年以上" / "3+ years"
  const cn = text.match(/(\d{1,2})\s*[-~—至]\s*(\d{1,2})\s*年/);
  const cnMin = text.match(/(\d{1,2})\s*年(以上|\+)/);
  const enRange = text.match(/(\d{1,2})\s*[-~]\s*(\d{1,2})\+?\s*(years?|yrs?)/i);
  const enMin = text.match(/(\d{1,2})\s*\+\s*(years?|yrs?)/i);
  const lo = cn ? +cn[1] : cnMin ? +cnMin[1] : enRange ? +enRange[1] : enMin ? +enMin[1] : null;
  const hi = cn ? +cn[2] : enRange ? +enRange[2] : lo;
  if (lo !== null && hi !== null) {
    if (lo <= 2) levels.add("junior");
    if (hi >= 3 && lo <= 5) levels.add("mid");
    if (hi >= 5) levels.add("senior");
  }
  return [...levels];
}

// ---------- 统一派生 ----------
export type JobTags = {
  roles: RoleId[];
  regions: RegionId[];
  languages: LangId[];
  experience: ExpLevel[];
};

/** 岗位（标题+公司+地点+摘要）→ 全部细化标签。 */
export function deriveJobTags(parts: {
  title: string;
  company?: string;
  location?: string;
  snippet?: string;
}): JobTags {
  const roleText = [parts.title, parts.snippet ?? ""].join(" ");
  const fullText = [parts.title, parts.company ?? "", parts.location ?? "", parts.snippet ?? ""].join(" ");
  return {
    roles: classifyRoles(roleText),
    regions: classifyRegions([parts.location ?? "", parts.title].join(" ")),
    languages: detectLanguages(fullText),
    experience: detectExperience(fullText),
  };
}

/** 监测任务的细化匹配条件（与 JobTags 求交；空条件 = 不过滤）。 */
export function matchesTags(
  tags: JobTags,
  want: {
    matchRoles: string[];
    matchRegions: string[];
    matchLanguages: string[];
    matchExperience: string[];
  },
  location?: string | null,
): boolean {
  if (want.matchRoles.length > 0 && !tags.roles.some((r) => want.matchRoles.includes(r))) {
    return false;
  }
  if (want.matchRegions.length > 0) {
    const presetIds = new Set<string>(REGION_IDS);
    const hit = want.matchRegions.some((w) =>
      presetIds.has(w)
        ? tags.regions.includes(w as RegionId)
        : !!location && location.toLowerCase().includes(w.toLowerCase()),
    );
    if (!hit) return false;
  }
  if (
    want.matchLanguages.length > 0 &&
    tags.languages.length > 0 &&
    !tags.languages.some((l) => want.matchLanguages.includes(l))
  ) {
    return false;
  }
  if (
    want.matchExperience.length > 0 &&
    tags.experience.length > 0 &&
    !tags.experience.some((e) => want.matchExperience.includes(e))
  ) {
    return false;
  }
  return true;
}
