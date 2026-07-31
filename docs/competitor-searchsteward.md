# 竞品调研：SearchSteward

> 调研日期：2026-07-29
> 目的：评估 SearchSteward（Job Search Radar & Pipeline Tracker）有哪些功能可移植到 CareerOS，避免重复建设、补齐差异化能力。
> 状态：第一轮调研完成，待继续深入研究（见文末「待续研究方向」）。

---

## 1. SearchSteward 产品概述

- **定位**：Job Search Radar & Pipeline Tracker —— 帮你"盯公司职业页"，而不是帮你整理已找到的岗位。
- **核心循环**：用户指定目标公司 → 系统 24h 重扫其职业页（Greenhouse/Lever/Ashby/Workday 等，官网称 40+ ATS、覆盖 57,730 个公司职业页——均为官网口径，未独立验证）→ 对新岗位按用户 profile 打 **0–100 分（带理由）** → 用户管线追踪申请（Applied/Screening/Interview/Offer）+ Gmail/Calendar 同步 + AI 简历定制 + 谈薪剧本 + 结果分析。
- **差异化口号**："Most tools organize the search. This one does the search."（Tracker 整理你已发现的岗位；它从你指定的公司出发替你持续找）。
- **主导航（侧边栏）**：`Today` | `Matches` | `Search` | `Applications` | `Companies` | `Writing Studio` | `Insights` | `Settings`。顶部有全局按钮 **"+ Add application"**，可手动录入正在投递的岗位。
- **定价**（⚠️ 均为官网口径，2026-07 抓取，未独立验证；币种 USD，定价随时可变）：Free（25 目标公司 / 50 次评分·月 / 10 次 AI 评估 / 全功能管线）、14 天 Trial、Radar $19·月（1000 匹配 / 500 AI 评估 / 无限公司）。强调"不自动投递、用户数据不是产品"。
  > 单位说明（官网未明确定义，以下为推测）：**评分**=规则/embedding 打分次数，**匹配**=雷达命中并入库的岗位数，**AI 评估**=调用 LLM 的深度分析次数——三者计量口径不同，跨档对比时勿混算。
- **3 个免登录浏览器工具**（营销/获客入口，纯前端、不上传）：
  1. Résumé ↔ JD Matcher：粘贴简历 + JD → 关键词重合度评分（Strong 75+ / Partial 45–74 / Weak <45）+ 命中/缺失关键词高亮。
  2. Ghost Job & Scam Checker：粘贴招聘文 → 红旗检测（预付费用 / 索要敏感信息 / 用聊天软件面试 / 个人邮箱联系 / 无薪资 / 描述模糊）。
  3. Top 200 / Top 50 Remote Companies Hiring：按实时在招职位数排名，日更，无陈旧 repost。

---

## 2. SearchSteward 功能清单（详细）

### 2.1 雷达 / 匹配引擎
- **目标公司管理**：用户挑公司，系统自动找其职业板并保持连接健康（ATS 迁移/改名时自愈）。
- **Profile 抽取**：粘贴简历/LinkedIn/摘要 → 抽取 **目标 titles + 加权 keywords**（30+ 词即可，全文更准）。
- **画像校准顾问（Advisor）**：扫描前先数"实时索引中匹配你 profile 的职位数"，给出 `well-calibrated / too vague / too strict` 判定，引导用户调整。
- **硬门槛（Hard gates，确定性规则，直接丢弃）**：地点/工作类型不符、排除的 title、安全许可要求、陈旧 listing。
- **加权评分（0–100，带命名驱动因子）**：title 匹配、必需/优先关键词命中、exact-title 特长加分、负面关键词与缺失 must-have 扣分、seniority 乘数；稀疏 posting 会拉低置信度（不伪造高分）。
- **打分明细可读**：每个岗位卡片显示分数 + 原因（title 匹配 / seniority 对齐 / 关键词命中）；可 Dismiss 教雷达"不想要什么"。

### 2.2 岗位详情与动作
- 分数拆解、原始 posting、直连雇主 Apply 链接、**Tailor resume**（一键按该 posting 语言改写简历，**不虚构**）、一键追踪（track）。
- Apply 后进入 Applications（管线：表格 / Kanban / 详情视图，含阶段、下一步动作、面试备注）。

### 2.3 管线与日常
- **申请管线**：Considering → Applied → Screening → Interview → Offer，带阶段、next actions、interview notes。支持手动「+ Add application」录入，也支持从雷达一键追踪。
- **Today 主页**：每天新匹配 + 跨申请的下一步动作。右侧「Do today」是可执行待办（如 *Send Thank You*、*Schedule Interview*），带预估耗时（截图示例：`3 items · ~25 min`）。
- **Gmail / Calendar 同步**（外部 OAuth 集成）。
- **谈薪剧本（Negotiation playbooks）**：offer 到手后的谈判指引。
- **结果分析（Insights / Outcomes）**：
  - 按分数带回复率、哪个简历版本表现好、内推是否有效、48h 内投递是否有用；
  - **关键词-面试阶段相关性**：追踪已投递岗位中的哪些关键词与"进入筛选/面试"高度相关（对优化简历关键词极具价值）。

### 2.4 文书工坊（Writing Studio）
- 从侧边栏独立入口可见，定位应为 AI 辅助的求职文书中心：简历定制、求职信、感谢信、跟进邮件等。与岗位详情里的 **Tailor resume** 形成场景互补：岗位内是"为这个 JD 生成"，Writing Studio 是"通用/多版本管理"。
- 可移植到 CareerOS 的方式：在简历生成/导出之外，增加 cover letter / thank-you note / follow-up email 的 AI 生成能力。
- ✅ **已完成（2026-07-30）**：`/writing` 文书工坊 + `api/v1/writing/generate`（web 侧同步调 DeepSeek，复用 `lib/ai.ts`）。支持求职信/感谢信/跟进邮件 × 中/英/日 × 正式/热情/简洁；自动注入用户职业档案（头衔/简介/近期经历/技能）作上下文，prompt 强约束「只用真实经历、不编造」；结果可编辑 + 复制。

### 2.5 免费工具（见 1）
关键词匹配器、幽灵岗/诈骗检测、公司排行榜（均免登录、纯前端）。

---

## 3. 图片/原文揭示的 UI/UX 细节（补充）

截图显示的是 `Today` 页面，可据此还原关键界面信息：
- **顶部**：`Good morning, Eric` + 全局按钮 `+ Add application`。
- **New on your radar**：横向滚动卡片流，每张卡片包含：
  - 公司 Logo 占位（首字母）；
  - 岗位 title、公司名、地点、薪资范围；
  - 右侧圆形 **分数徽章**（截图示例：92 / 86 / 95）；
  - 下方 **命名驱动因子**（如 *Title match: Strong match for product manager* / *Seniority aligns with your target* / *Matches seniority score of your priority keywords* / *Overall fit: ...*）；
  - `View` 按钮。
- **Do today**：可执行待办列表，示例包括：
  - *Send Thank You — Product Manager, New Assets*（日期 + `Send Thank You` 按钮）；
  - *Schedule Interview — Sr. Technical Product Manager – Platform Services*（`Schedule Interview` 按钮）；
  - 顶部显示 `3 items · ~25 min`（任务数 + 预估耗时）。

> 这些细节说明 SearchSteward 把"匹配"和"行动"做了强耦合：高匹配岗位直接推送到首页，并基于管线状态生成当日待办。

---

## 4. CareerOS 现状核对（基于代码探索，2026-07-29）

> 探索子代理已核实以下文件，结论可靠。

| 能力 | 现状 | 关键文件 |
|------|------|----------|
| JD↔简历匹配打分(0-100+理由) | ✅ **已具备**：embedding 为主 + 关键字/集合为辅，不调 LLM；内部 `matchScore` 为 **0–1**（`jobMatch.ts:133` `round2`，展示层×100 得 0–100）+ `missingSkills`(含 suggestion) + `matchedEvidence`(jdItem→实体 label + 相似度%) | `apps/worker/src/jobs/jobMatch.ts`、`apps/web/src/app/api/v1/jds/[id]/match/route.ts`、`matches/[id]/route.ts`、`apps/worker/src/ai/embedding.ts` |
| 简历→JD 定向定制 | ✅ **已具备**：`resumeGenerate` 接受 `jdId`，据 `matchedEvidence.entityId` 前置相关经历/项目 | `apps/web/src/app/api/v1/resumes/generate/route.ts`、`apps/worker/src/jobs/resumeGenerate.ts`、`jobs/[id]/page.tsx`「生成简历」按钮 |
| 岗位发现/监测(多源+品类) | ✅ **已具备**：15 个 connector（boss/字节/腾讯/greenhouse/lever/liepin/mihoyo/indeed/remoteok/hackernews/wantedly/finance/tech/cnApi/green）下配置约 50 个 feed（Greenhouse 13 游戏+23 金融/Playwright 中文站/RemoteOK/HackerNews/Wantedly 等）+ 品类/职种/地区/语言/经验筛选 + `runNow` + `newJobCount` 角标 | `apps/web/src/app/(app)/monitor/page.tsx`、`watches/*`、`discovered-jobs/*`、`apps/worker/src/sources/*` |
| 简历解析抽取 profile | ✅ **已具备**：上传 → 抽 experiences/projects/skills/achievements/educations（含 company title + skill 名 + techStack） | `apps/web/src/app/api/v1/imports/resume/route.ts`、`apps/worker/src/ai/tasks/resumeParse.ts`、`packages/shared/src/extraction.ts` |
| 申请投递看板 Kanban | ✅ **已完成（2026-07-30，C）**：`Application` + `ApplicationEvent` 模型（stage/notes/nextAction/时间线）；`/applications` 看板（6 列拖拽 + 新增）+ `/applications/[id]` 详情（改阶段/备注/下一步/时间线/删除）；监测卡片「追踪」一键建申请（带 matchScore 快照 + 去重） | `packages/db`（Application）、`app/(app)/applications/*`、`api/v1/applications/*` |
| 发现岗位自动打分排序 | ✅ **已完成（2026-07-30，B）**：`scoreDiscoveredJobs` 用岗位文本↔档案实体 embedding 相似度打 0-100 fit 分（岗位级 band 0.10~0.32）+ 命中理由；watchPoll 入库后自动评分 + `/discovered-jobs/score` on-demand；feed 按 `matchScore desc` 排序，monitor 卡片显示分数徽章 + 理由 | `apps/worker/src/jobs/scoreDiscovered.ts`、`monitor/page.tsx`、`api/v1/discovered-jobs/*` |
| 免登录公开工具 | ✅ **已完成（A）**：`/tools/matcher`（简历↔JD 匹配器）+ `/tools/scam-checker`（诈骗检测）+ `/tools/leaderboard`；middleware 已放行 `/tools`、`/api/tools`、`/welcome` | `app/tools/*`、`app/api/tools/*`、`middleware.ts` |
| 公司/来源排行榜 | ✅ **已完成（D）**：`/tools/leaderboard` 聚合展示（= 免费工具③） | `app/tools/leaderboard/*`、`api/tools/leaderboard` |
| Dashboard「今日」 | ✅ **已完成（2026-07-30，E）**：档案 Hero/统计卡之上新增「今日」band——**今日新匹配**（高分未处理发现岗位 Top5）+ **下一步待办**（有 nextActionAt 的申请，逾期/今天/N 天后标签，接申请看板） | `apps/web/src/app/(app)/dashboard/page.tsx` |
| 硬门槛 + 画像校准 | ✅ **已完成（2026-07-30，F）**：JobWatch 加 `excludeKeywords`（title/snippet 命中即丢，如 外包/派遣/实习）+ `maxAgeDays`（陈旧过滤），watchPoll `passesHardGates` 确定性丢弃 + 监测表单可配；画像校准顾问 `/watches/calibration` 统计 fit 分分布给「太严/太宽/良好」判定，监测页 banner 展示。（薪资地板因薪资文本非结构化暂缓） | `watchPoll.ts`、`packages/shared/watch.ts`、`api/v1/watches/calibration`、`monitor/page.tsx` |

---

## 5. 差异化定位与市场边界

> ⚠️ 本节回答一个前面各节都没答的关键问题：**"用户为什么不直接用 SearchSteward，而用 CareerOS？"** 若只照抄功能，路线图会退化成"追着竞品做减法"。

### 5.1 我们的差异化：知识库在前，雷达在后
- **SearchSteward 的主轴**：`目标公司 → 雷达重扫 → 打分 → 管线追踪`——本质是一个"发现 + CRM"工具，简历/画像只是打分的输入。
- **CareerOS 的主轴**：`职业知识库（WorkLog/经历/项目/技能证据）→ 数据驱动 profile 抽取 → 简历生成 → JD 匹配`——护城河是**结构化的、可累积的个人职业数据资产**（基于 WeKnora 集成）。
- **结论**：Kanban、简历定制、分析这些是赛道**标配**，不是护城河；抄它们是为了"不比竞品缺"，真正的差异化是"**别人换工具要重填资料，我这里资料越用越厚**"。移植功能时应始终让新功能**回流沉淀到知识库**（如申请结果 → 反哺技能证据权重），而非做成孤立 CRM。

### 5.2 市场/语言错位：功能不能 1:1 移植
SearchSteward 明显是**英文 / 美国市场**产品（Greenhouse/Lever/Ashby、Top Remote US Companies、美式谈薪）；CareerOS 覆盖**中文 / 亚太源**（boss/字节/腾讯/liepin/mihoyo/wantedly）。以下功能需本地化重写，不可直接搬：

| 功能 | 美国市场做法 | 中文市场需改造 |
|------|------|------|
| 幽灵岗/诈骗红旗 | "个人邮箱联系""用聊天软件面试"=红旗 | 国内 HR 常用个人微信/QQ，需重定义红旗（如"入职押金""刷单""培训贷"才是本地红旗） |
| 谈薪剧本 | base/equity/sign-on/RSU/relocation | 国内以 base×N 月 + 年终 + 期权/股票，equity 权重低，需重写维度 |
| 公司排行榜 | verified-live / 去 repost | 中文源 repost、外包岗、"急聘"刷新机制不同，去重口径要重定义 |
| 硬门槛 | 安全许可(clearance)、work authorization | 国内几乎无 clearance，换成"户口/派遣/外包/学历卡"等本地门槛 |

> **建议**：在第 6 节可移植性矩阵评估每项时，额外考量"本地化改造量"——部分项（如谈薪剧本、诈骗检测）表面"低投入"，实则**规则库需从零为中文市场重建**。

### 5.3 风险与前提（路线图的隐含假设）
- **公开工具的 SEO 价值是假设，非既定收益**：P0 免费工具能否带流量取决于落地页内容、可索引性、外链策略，"上线即有 SEO"过于乐观——需配套内容运营才能兑现。
- **爬虫 / ToS 合规**：雷达重扫、50 feed、公司排行榜公开页（#8/D）均涉各 ATS/招聘站的服务条款与反爬风险，公开露出前需过一遍合规。
- **Insights 冷启动**：#13（分数段回复率、简历 A/B、关键词-面试相关性）需**足够申请样本**才有统计意义——单用户几十条申请算不出显著相关性；要么跨用户聚合（涉隐私），要么定位为"晚期功能"，勿早做。

---

## 6. 可移植性矩阵

| # | 功能 | SearchSteward | CareerOS | 可行性 | 价值 | 建议 |
|---|------|------|------|------|------|------|
| 1 | JD↔简历匹配打分(0-100+理由) | ✅ | ✅ 已有 | 已具备 | — | 不重复建设 |
| 2 | 简历→JD 定向定制 | ✅ | ✅ 已有 | 已具备 | — | 不重复 |
| 3 | 岗位发现/监测(多源+品类) | ✅ | ✅ 已有 | 已具备 | — | 不重复 |
| 4 | 简历解析抽取 profile | ✅ | ✅ 已有 | 已具备 | — | 不重复 |
| 5 | **申请投递看板 Kanban** | ✅ | ✅ **已完成(C)** | — | **高（护城河）** | ✅ 2026-07-30 落地 |
| 6 | **发现岗位自动打分排序** | ✅(雷达) | ✅ **已完成(B)** | — | 高 | ✅ 2026-07-30 落地 |
| 7 | **免登录公开工具(3个)** | ✅ | ✅ **已完成(A)** | — | 高 | ✅ matcher/scam/leaderboard |
| 8 | **公司/来源开放职位数排行榜** | ✅ | ✅ **已完成(D)** | — | 中高 | ✅ tools/leaderboard |
| 9 | Dashboard「今日新匹配/下一步」 | ✅ | ✅ **已完成(E)** | — | 中 | ✅ 2026-07-30 落地 |
| 10 | 硬门槛/偏好前置 | ✅ | ✅ **已完成(F)** | — | 中 | ✅ 排除词+陈旧过滤(薪资地板暂缓) |
| 11 | 画像校准顾问 | ✅ | ✅ **已完成(F)** | — | 中 | ✅ fit 分分布判定 |
| 12 | 谈薪剧本 | ✅ | ✅ **已完成** | — | 中 | ✅ 2026-07-30 落地（本地化维度） |
| 13 | 结果分析 Insights（申请漏斗、**匹配分↔进面试率**、当前阶段分布） | ✅ | ✅ **已完成** | — | 中 | ✅ 2026-07-30（样本量诚实提示；简历A/B/内推等待数据） |
| 14 | Gmail/Calendar 同步 | ✅ | ❌ | — | — | **外部 OAuth，跳过** |
| 15 | **Writing Studio（AI 求职信/感谢信/跟进邮件）** | ✅ | ✅ **已完成** | — | 中 | ✅ 2026-07-30 落地 |

---

## 7. 移植优先级路线图

> **进度（2026-07-30）**：🎉 **全部完成** —— ✅ A（免费工具）、✅ B（打分排序）、✅ **C（Kanban，护城河）**、✅ D（排行榜）、✅ **E（Dashboard「今日」）**、✅ **F（硬门槛 + 画像校准）**、✅ **Writing Studio**、✅ **G（谈薪剧本，本地化）**、✅ **Insights（结果分析）**。SearchSteward 可移植功能已全数落地（Gmail/Calendar 同步按 §8 跳过；Insights 的简历 A/B、内推效果等子项待真实数据积累后再补）。

### P0 — 投入最小、对外价值最大（建议先做）
- **A. 两个免登录公开工具**（✅ 已完成）（几天可出，SEO/获客利器）
  - ① 简历↔JD 关键词匹配器：客户端算关键词重合度 → Strong/Partial/Weak + 命中/缺失高亮；可纯前端零上传（隐私卖点）。
  - ② 幽灵岗/诈骗检测器：接现有 DeepSeek，粘贴招聘文 → 红旗清单 + 严重度。
  - 复用：前端能力 + `apps/worker/src/ai/provider.ts`（DeepSeek）。需新增 public 路由（绕过 auth middleware）。
- **B. 发现岗位自动打分排序**（✅ 已完成 2026-07-30）：`scoreDiscoveredJobs` 用岗位文本↔档案实体 embedding 相似度打 0-100 fit 分 + 理由，feed 按分排序。注意——未复用 `jobMatch`（那需已解析 JD），而是走岗位级 embedding，band 专门标定为 0.10~0.32（text-embedding-3-small 上强匹配≈0.32）。

### P1 — 核心差异化
- **C. 申请投递看板 Kanban**（✅ 已完成 2026-07-30）：`Application` + `ApplicationEvent` 模型（stage/notes/nextAction/时间线）；`/applications` 6 列看板（原生拖拽切换阶段 + 手动新增）+ `/applications/[id]` 详情（阶段/下一步/备注/时间线/删除）；监测 feed「追踪」按钮一键建申请（带 matchScore 快照 + 按发现岗位去重）。SearchSteward 护城河，本轮补齐。
- **D. 公司/来源排行榜公开页**：聚合 `DiscoveredJob.source/company` 计数 → Top 200 / Top 50 远程，日更。

### P2 — 增强
- **Insights 结果分析**（✅ 已完成 2026-07-30）：`/insights` + `lib/insights.ts`。基于申请追踪数据算**申请漏斗**（曾到达≥各阶段，从 ApplicationEvent 时间线复原）、**匹配分↔进面试率**（验证打分与真实结果相关性）、当前阶段分布；样本 <10 条时显示诚实的统计提示。简历 A/B、内推效果、48h 等子项待真实数据积累后再补。

- **E. Dashboard「今日」**（✅ 已完成 2026-07-30）：档案 Hero 之上新增「今日」band——今日新匹配（高分未处理发现岗位 Top5，接 discoveredJob.matchScore）+ 下一步待办（Application.nextActionAt，逾期/今天/N 天后标签，接申请看板）。
- **F. 硬门槛前置 + 画像校准顾问**（✅ 已完成 2026-07-30）：JobWatch `excludeKeywords`（排除 title/snippet 命中词，如 外包/派遣/实习）+ `maxAgeDays`（陈旧过滤），watchPoll `passesHardGates` 确定性丢弃；画像校准顾问 `/watches/calibration` 按 fit 分分布给「太严/太宽/良好」判定，监测页 banner 引导调整。薪资地板因薪资文本非结构化暂缓。
- **G. 谈薪剧本**（✅ 已完成 2026-07-30）：`/negotiation` + `api/v1/negotiation/generate`（同源 Writing Studio，DeepSeek）。按**中国市场薪酬结构**（月薪×薪数 + 年终 + 签字费 + 期权[权重低]）生成，覆盖 base/年终/签字费/期权/到岗/职级/地点维度，输出整体策略 + 分维度话术 + 避坑；注入用户档案，强约束不编造数字、信息不足则提示「先问清 X」。

### 工作量估算与验收 KPI（替代"低/中/高投入"）
> 估算为单人粗略区间，含本地化改造量；KPI 用于上线后判断是否成功。

| 项 | 粗估人天 | 本地化改造量 | 验收 KPI |
|----|----------|--------------|----------|
| A. 两个免费公开工具 | 3–5d | 诈骗检测规则库需为中文市场重建（中） | 月 UV、工具页→注册转化率 |
| B. 发现岗位自动打分排序 | 2–4d | 低（复用 jobMatch） | feed 中带分岗位占比、点击率 |
| C. 申请投递 Kanban | 2–3w | 低 | 周活用户创建的 application 数、阶段流转率 |
| D. 公司/来源排行榜公开页 | 1–2w | 去重/去 repost 口径需重定义（中） | 榜单页 UV、外链数 |
| E. Dashboard「今日」 | 1w | 低 | 首页「下一步」点击率、次日留存 |
| F. 硬门槛 + 画像校准 | 1–2w | 门槛项需换成户口/派遣/学历卡（中） | 门槛过滤掉的无效岗位比例 |
| G. 谈薪剧本 | 3–5d | 维度需按国内 base×N+年终+期权重写（高） | 生成使用次数、offer 用户采用率 |

---

## 8. 暂不移植项
- **Gmail / Calendar 同步**：依赖外部 OAuth 集成，超出当前范围，跳过。
- **盯 57k+ 公司职业页 24h 重扫**：CareerOS 已用 15 连接器 / ~50 feed + monitor 任务覆盖同类目标，路线不同但目标一致，无需照搬其爬虫规模。

---

## 9. 产品演进、技术栈与竞品参照

### 9.1 从痛点到产品的 MVP 演进
图片中的中文原文完整记录了 SearchSteward 的迭代路径，对 CareerOS 路线图有重要参考：
1. **Claude 整理简历**：把职业生涯内容（项目、技术、职位等）导入长文本 → Claude 梳理成完整简历并充当职业顾问提问题。
2. **脚本抓 ATS**：厌倦手动刷 LinkedIn/Indeed → 让 Claude 写 Python 脚本抓取金融科技公司 ATS 职位 → 导出 CSV。
3. **评分+排序**：按个人资料匹配度对职位排名 → 加入**负面关键词**过滤不感兴趣岗位 → 加入可调关键词/权重 → 优化评分。
4. **GUI**：从脚本变成图形界面。
5. **申请追踪 CRM**：匹配结果中标记申请职位 → 自动生成卡片 → 可填简历/经历备注 → 加入面试准备与追踪 → 实现 Gmail 同步。
6. **全面重构**：Streamlit + SQLite → **React/TypeScript 前端 + Python/FastAPI 后端 + Postgres**，部署在 Cloudflare / Railway / Hostinger 上。
7. **Fable 工作流升级**：AI 规划功能 → 创建子代理执行 → 人工审查，大幅提升开发效率。
8. **数据分析上线**：分数段回复率、简历版本 A/B、内推效果、48h 内申请重要性、关键词-面试阶段相关性。

### 9.2 技术栈
- **前端**：React / TypeScript
- **后端**：Python / FastAPI
- **数据库**：Postgres
- **部署**：Cloudflare + Railway + Hostinger
- **开发方式**：先 Claude 辅助，后 Fable（AI 规划 + 子代理执行 + 人审）

> CareerOS 当前是 Next.js 16 + React 19 + Prisma + Postgres + BullMQ + MinIO，技术路线相近，移植功能时无需切换栈。

### 9.3 竞品参照
- **Hiring Cafe**：按关键词评分并推送职位。
- **Huntr**：同样是岗位推送 + 追踪。
- 原文评价：两者都未能完全满足需求，因此 SearchSteward 走了"雷达 + 管线 + 分析"一体化路线。
- **建议横向调研**：Simplify / Teal / Careerflow，以确认申请看板、简历定制、分析模块的赛道标配边界。

---

## 10. 待续研究方向（后续调研清单）
> 本节只保留"尚无结论、需继续查"的问题。诈骗红旗、谈薪维度、排行榜去重等**本地化结论已在 5.2/5.3 给出**，此处不再重复列为待办，仅保留其中未解的算法/口径细节。

1. **定价与转化细节**：Free/Trial/Radar 三档的 gate（如 25 公司限制如何实现）、取消流程、是否区分地区定价。
2. **完整 UI 实拍**：Today/Matches 部分已见截图，待补全 setup wizard 6 步、Applications Kanban、Companies、Writing Studio、Insights 各页面的具体布局与交互（用于 C/E/G 的 UI 设计参考）。
3. **Writing Studio 功能边界**：是否只包含简历/求职信/感谢信？是否支持版本管理和 A/B 测试？
4. **Insights 数据指标定义**：关键词-面试阶段相关性的具体计算口径（是统计显著性、lift、还是简单共现？）。
5. **Negotiation playbook 内容结构**：是静态模板还是 AI 生成？（维度的**本地化改写**已在 5.2 定案，此处仅剩"模板 vs AI 生成"这一形态问题待查）
6. **Stale listing 检测算法**：如何判定"陈旧/ghost"——红旗的本地化分工已在 5.2 明确，此处仅剩**判定算法本身**（时间窗？repost 指纹？）待研究。
7. **Top Companies 去重算法**：去重/去 repost 的**口径方向**已在 5.2 定案，此处仅剩"verified-live"的**具体判定实现**待对齐（做 D 时用）。
8. **匹配引擎细节**：其 seniority 乘数、specialty bonus、negative keyword 惩罚的具体权重，能否借鉴微调我们的 `jobMatch.ts`。
9. **竞品横向对比**：Simplify / Teal / Huntr / Careerflow 的申请看板、简历定制、分析模块标配边界。

---

## 11. 决策备忘
- **第一个动手项建议 = P0-A（两个免费工具）**：投入最小、对外价值最大、立刻可在官网露出，且已有 AI + 前端能力。
- **新增发现**：图片/原文补齐了 `Writing Studio` 独立入口、Today 页「Do today」可执行待办（Send Thank You / Schedule Interview）、关键词-面试阶段相关性分析、以及 Hiring Cafe / Huntr 两个直接竞品。这些均已补充进文档。
- 待用户确认后，再从 P0/P1 选定具体实施项；若先做免费工具，可顺手把 Writing Studio 中的 *thank-you note* 也做成首个公开工具Demo。
