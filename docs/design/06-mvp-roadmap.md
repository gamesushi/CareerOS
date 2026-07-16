# CareerOS MVP 路线图（4 Sprint × 2 周）

MVP 闭环 = 上传简历 → 解析确认 → 职业库 CRUD → 上传 JD → 匹配 → 生成简历 → 导出 PDF。
每个 Sprint 末有可演示的验收物。任务粒度 ≈ 0.5~2 天/项。

---

## Sprint 1 — 骨架与职业库（先手动，后 AI）

**目标**：不靠任何 AI，用户可以登录并手工维护完整职业数据库。

**基础设施**
- [ ] Monorepo 初始化：`apps/web`（Next.js 16 + Tailwind + shadcn/ui）、`apps/worker`（BullMQ）、`packages/shared`（zod schema 单一来源）
- [ ] docker-compose：postgres(pgvector) + redis + minio + weknora（官方 compose 嵌入，先只起不接）
- [ ] Prisma schema 落 01 文档 DDL（enum/索引用 raw migration 补），种子脚本
- [ ] Auth.js：email magic link + Google；`users` 表接管；middleware 登录 gate

**功能 / API**
- [ ] `GET/PUT /me`（含 locale/job_status/privacy）
- [ ] experiences / projects / skills(+evidences) / achievements / educations 全套 CRUD（zod→route handler 模板化，一套写五份）
- [ ] `GET /career/timeline`

**页面**
- [ ] 全局布局（Sidebar/Topbar）+ Settings(账户/隐私)
- [ ] `/knowledge` 四 Tab 全量 CRUD（时间轴 + Sheet 表单）
- [ ] `/skills` SkillGrid + 证据手动添加（成长曲线可后置）
- [ ] Dashboard v0：StatsRow + 时间轴预览 + 空态 ImportFirstScreen（按钮先 disabled）

**验收**：手工录入一份完整履历，知识库/技能中心可视化正确；多用户数据隔离通过测试。

---

## Sprint 2 — 导入管线（第一条 AI 链路）

**目标**：PDF/DOCX 简历 → 确认页 → 入库。

**基础设施**
- [ ] WeKnora 接通：服务级 API Key；注册时惰性建用户 KB；docreader 调用封装
- [ ] AI Gateway 骨架：gateway/providers/audit(ai_runs)/BullMQ `ai` 队列 + TaskProgress SSE（`/tasks/:id/events`）
- [ ] MinIO 上传（预签名 PUT）

**功能 / API**
- [ ] `POST /imports/resume` → parse(docreader) → extract(resumeParse task) 状态机全链
- [ ] resumeParse prompt + zod 契约 + 置信度 + 库内查重（name_norm，向量查重 Sprint 3 补）
- [ ] `GET /imports/:id/extracted`、`POST /imports/:id/apply`（事务写入 + source=import + is_stale 置位）

**页面**
- [ ] `/imports/[id]/review` 确认页（SplitView 全套，本 Sprint 最大 UI 项）
- [ ] Dashboard 空态接通上传；导入历史列表

**验收**：3 份真实简历（中文 PDF / 英文 PDF / 日文職務経歴書 DOCX）走通全链，抽取错误可在确认页修正后入库；失败路径（坏文件）有可读报错。

---

## Sprint 3 — 向量与 JD 匹配

**目标**：JD 进，匹配报告出。

**基础设施**
- [ ] embedding.ts + embeddings 表写入（实体创建/更新钩子，content_hash 去重）
- [ ] 存量实体回填 embedding 的批任务

**功能 / API**
- [ ] `POST /jds/import`（文本/文件/URL 三态）+ jdParse task
- [ ] `POST /jds/:id/match`：三路打分（3.2 节公式）+ missing_skills 建议（小模型）
- [ ] `POST /search` 跨实体语义检索（Topbar ⌘K）
- [ ] worklogSummarize + `/worklogs` 页面（QuickComposer + SuggestionRow）——日志开始为技能积累证据
- [ ] profileGenerate + Dashboard ProfileHeroCard/StaleBanner

**页面**
- [ ] `/jobs` 列表 + `/jobs/[id]` 匹配报告（ScoreGauge/证据对照/缺口卡）
- [ ] `/worklogs`、Skill Center 成长曲线补全

**验收**：同一 JD 在补充相关项目证据前后匹配分可见提升（验证飞轮成立）；匹配全程 <10s。

---

## Sprint 4 — 简历生成与导出（闭环）

**目标**：从匹配报告一键生成简历并导出 PDF。

**功能 / API**
- [ ] FactPack 组装（带 JD 筛选 / 无 JD 全量两模式）
- [ ] resumeGenerate task（JSON Resume 输出 + 事实包含性校验 x-warnings）
- [ ] translate task（en；ja_shokumu 文体 + x-jis 段）
- [ ] `resumes` CRUD + `POST /resumes/:id/export`（react-pdf 服务端渲染 → MinIO）

**页面**
- [ ] OpenResume 渲染层引入（抽其模板组件，适配 JSON Resume 输入）：先 2 个模板（classic/compact）+ 自研 ja_shokumu 模板 v0
- [ ] `/resumes` 列表 + `/resumes/[id]` 编辑器（SectionEditor + LivePreview + FactWarningBar）
- [ ] `/knowledge/graph` 图谱视图（react-flow，只读）
- [ ] Onboarding checklist、整体打磨与 i18n（zh 全量，en/ja 界面可 Sprint 后补）

**验收（= MVP 验收）**：新用户 15 分钟内完成"注册→导入简历→确认→上传JD→查看匹配→生成简历→下载 PDF"全程无工程师介入；核心页面移动端不破版。

---

## 里程碑后的第一批增量（不排期，仅记录优先级）

1. 简历版本对比 / 更多模板（评估 Reactive Resume 适配器）
2. WorkLog 集成：GitHub commits → 日志草稿（用户群最技术向，最先做）
3. Recruiter 侧最小功能（人才搜索，吃 privacy 开关）
4. 推荐信/求职信/面试问答生成（复用 FactPack 机制，边际成本低）

## 风险清单

| 风险 | 缓解 |
|---|---|
| LLM 抽取质量决定第一印象 | 确认页兜底 + 三语真实简历回归集（testdata/，每次 prompt 变更跑一遍） |
| 日文職務経歴書格式复杂 | 模板 v0 只做标准两页式；找 2-3 份真实样本对照 |
| WeKnora 升级破坏兼容 | 只依赖其 REST 契约，版本 pin 在 compose，升级走 staging 验证 |
| 用户不回来维护数据（核心假设） | Sprint 3 的日志飞轮 + 匹配分数提升可视化是留存实验本体，埋点从第一天做 |
