# CareerOS 架构决策记录（ADR）

> 状态标注：✅ 已定 / ⚠️ 建议（与计划书有出入，待拍板）

---

## ADR-001 ⚠️ WeKnora 的角色：集成而非改造

**计划书原文**：Phase 1 "将现有 Weknora 改造成职业知识管理系统"。

**决策**：WeKnora **原样部署、不 fork**，作为 CareerOS 的两个内部服务使用：

1. **文档解析引擎**：docreader（Python gRPC/HTTP 服务）负责 PDF/DOCX/图片 OCR → Markdown 文本。简历、JD 文件全部经它解析。
2. **RAG 检索引擎**：每个用户一个 WeKnora KnowledgeBase（"职业档案库"），原始简历、工作日志长文本入库，获得免费的 chunk/embedding/hybrid-search，用于"技能证据检索""相似经历搜索"。

CareerOS 通过 WeKnora 的 REST API（`/api/v1`，API Key 认证）调用，两者共享同一个 PostgreSQL 实例但**各自独立 schema**。

**理由**：
- WeKnora 上游活跃（v0.6.3，Go 1.26），fork 改造后无法跟进上游修复与新能力。
- 职业域实体（经历/项目/技能/成果）是强业务 CRUD，与 WeKnora 的知识库领域模型（KB/Knowledge/Chunk）不同构，硬塞进去两边都别扭。
- WeKnora 的 Tenant/RBAC/Agent 体系是为知识库产品设计的，CareerOS 的权限模型（用户拥有自己的职业数据 + 未来 Recruiter 检索）需要另起。

**代价**：多部署一套服务（docker-compose 里 WeKnora 已经是多容器，增量成本低）。

---

## ADR-002 ⚠️ 应用技术栈：Next.js 全栈，暂缓 NestJS

**计划书原文**：Frontend Next.js，Backend NestJS。

**决策**：MVP 阶段用 **Next.js 16 全栈**（App Router + Route Handlers + Server Actions）+ **独立 BullMQ worker 进程**（跑解析/生成等异步任务）。API 按本文档集的 REST 契约实现，未来若拆 NestJS，契约不变、前端零改动。

**理由**：
- 单人开发，双框架（两套 DTO、两套部署、跨域/鉴权桥接）纯增加摩擦。
- 团队既有栈就是 Next.js（margin 用 Next.js 16 + Supabase 已跑通全链路）。
- 重 CPU/长耗时任务本来就不该放 HTTP 进程里，BullMQ worker 独立进程即可，这一点与 NestJS 无关。

**技术清单**：
| 层 | 选型 |
|---|---|
| 前端/后端 | Next.js 16 + React + Tailwind + shadcn/ui |
| ORM | Prisma（schema 见 01 文档，DDL 为准） |
| 数据库 | PostgreSQL 16 + pgvector（与 WeKnora 共实例、分 schema：`careeros` / `weknora`） |
| 队列 | BullMQ + Redis |
| 对象存储 | MinIO（S3 兼容，本地开发）→ 生产可换 R2/S3 |
| 认证 | Auth.js（email magic link + Google OAuth），预留 Clerk 迁移可能 |
| AI | 自建 AI Gateway 模块（OpenAI / Gemini / DeepSeek，见 04 文档） |
| 文档解析 | WeKnora docreader |
| 证据/相似检索 | WeKnora hybrid-search + CareerOS 自有实体级 pgvector |

---

## ADR-003 ✅ 向量方案：PostgreSQL + pgvector，不用 Neo4j

与计划书一致。补充落地细节：

- **实体级向量**归 CareerOS 自己管：`embeddings` 多态表（`source_type` + `source_id`），HNSW 按维度分区索引（照抄 WeKnora 的成熟模式，`halfvec` + partial index）。
- **块级向量**（简历原文、日志长文的 chunk）归 WeKnora 管，CareerOS 不重复建。
- **职业图谱**用关系表 + 递归查询表达（`WORKED_AT` 等边即外键/关联表），前端用图可视化渲染。MVP 不引入图数据库；如果 Phase 7 SNS 的人脉关系查询复杂度上来，再评估 Apache AGE（Postgres 图扩展），依然不上 Neo4j。

---

## ADR-004 ⚠️ 简历渲染：OpenResume 优先，Reactive Resume 降为第二

**计划书原文**：第一优先 Reactive Resume，第二优先 OpenResume。

**决策**：优先级对调。

**理由**：
- Reactive Resume v4 自托管是**一整个平台**（NestJS + 自带 Postgres + MinIO + headless Chrome 打印服务），不是渲染库。"适配"它意味着部署第二个完整产品并做账号/数据同步，MVP 成本失衡。
- OpenResume 是 MIT 协议的 React + react-pdf 组件，可以把它的渲染层直接抽进 Next.js 代码库，`ResumeJSON → <ResumePDF/> → PDF Blob`，零额外部署。
- 两者模板都不覆盖**日本職務経歴書**（表格式、逆编年体、自我 PR 段落），日文输出注定要自研模板——用 react-pdf 自研恰好和 OpenResume 同一技术路线。

**保留的正确决策**：中间格式统一 **JSON Resume Schema**（`basics/work/projects/skills/education/awards`），CareerOS 只产 JSON，渲染器可插拔。Reactive Resume 作为 Phase 2+ 的"多模板豪华版"适配器（它支持导入 JSON Resume）。

日文職務経歴書不强行塞 JSON Resume：定义扩展字段 `x-jis`（職務要約、活かせる経験・知識、自己PR），见 01 文档 `resumes.resume_json`。

---

## ADR-005 ✅ 简历只是视图（View），不是数据源

与计划书一致，且是全系统最重要的不变量：

- 所有编辑动作落在职业实体表（experiences/projects/skills/...），**永不直接编辑简历**。
- `resumes` 表存的是**生成时刻的快照**（`resume_json`），带 `generated_at` 与来源 `jd_id`。用户在 Resume Center 里的"微调"写回快照 JSON（属于该版本），不回流实体库；想改事实，去知识库改，再重新生成。
- 导入简历是**单向入口**：文件 → 解析 → 结构化候选数据 → **人工确认页** → 写入实体库。解析结果必须过人工确认，LLM 抽取不可直接落库（防幻觉污染核心资产）。

---

## ADR-006 ⚠️ RBAC：五角色定义、两角色实现

角色矩阵按 Guest/User/Recruiter/Admin/Enterprise 完整设计（见 05 文档），但 MVP 只实现 **User + Admin**。`users.role` 字段与隐私开关（`privacy` JSONB）从第一天就在 schema 里，Recruiter/Enterprise 侧的查询走"隐私开关允许才可见"的行级过滤，逻辑预埋、入口不开。

---

## ADR-007 ✅ 多语言策略

- 用户界面：zh/en/ja 三语（next-intl）。
- **实体数据存原始语言**（`lang` 字段标记），不强制三语冗余。
- 简历生成时按目标语言由 LLM 翻译+本地化（不是逐字翻译，日文简历要重写为職務経歴書文体），结果固化进该 `resumes` 快照。翻译缓存在快照里，实体库保持单一事实源。

---

## ADR-008 ✅ MVP 边界（与计划书一致，再收紧一档）

做：上传简历 → 解析确认 → 职业数据库 CRUD → 上传 JD → 匹配 → 生成简历 → 导出 PDF。

不做（连表都可以后建的就后建）：SNS Feed、招聘企业端、语音日志、邮件/Notion/GitHub 同步、推荐信/面试问答生成、职业关系 Connection 功能（表结构预留）。

**验证指标**（决定是否进入 Phase 5+）：
- 导入后 30 天留存：用户是否回来补充/修订职业数据？
- 每用户手动新增实体数 ≥ 5（说明愿意维护，而不是导完就走）；
- 简历生成→导出转化率。
