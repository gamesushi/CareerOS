# CareerOS 项目总览 · 交接文档

> 版本：v1.0 ｜ 日期：2026-07-30 ｜ 面向：接手维护/扩展的开发者（hy3）
> 这是"状态快照"总览。各模块的设计/实现细节见文末「关联文档」。

CareerOS 的主线是：**职业知识库 → 简历 → 岗位发现打分 → 申请追踪 → 结果分析**，外加求职文书/谈薪 AI 工具与管理后台。定位是**中国市场优先**的求职操作系统。

---

## 1. 技术栈

- **前端/后端**：Next.js 16（App Router）+ React 19，一体化（web app + API routes）
- **数据**：Postgres（+ pgvector / citext / pg_trgm / pgcrypto 扩展）+ Prisma
- **队列**：BullMQ + Redis；后台处理器在 `apps/worker`
- **存储**：S3 / MinIO（简历 PDF、照片）
- **AI**：DeepSeek（Chat，`deepseek-v4-pro` / `-flash`）；OpenAI embedding（`text-embedding-3-small`）
- **鉴权**：Auth.js（NextAuth）JWT + Prisma Adapter；Google OAuth / 本地密码 / 邮件验证
- **Monorepo**：pnpm workspace（`apps/web`、`apps/worker`、`packages/db`、`packages/shared`）

---

## 2. 功能地图

### 2.1 核心链路（用户应用 `(app)/*`）
| 模块 | 路由 | 说明 |
|---|---|---|
| 职业知识库 | `/knowledge`、`/skills`、`/worklogs` | 经历/项目/技能/成果/工作日志 |
| 简历 | `/resumes`、`/imports` | 解析导入 + AI 生成（含日文履歴書/職務経歴書、多地区） |
| 岗位监测 | `/monitor` | 15 连接器/~50 feed；品类/职种/地区/语言/经验筛选 + **硬门槛**（排除词/陈旧）+ **画像校准顾问** |
| **发现岗位打分** | `/monitor` | 岗位文本↔档案实体 embedding fit 分（0-100）+ 理由，feed 按分排序 |
| **申请追踪 Kanban** | `/applications`、`/applications/[id]` | 6 阶段看板（拖拽）+ 时间线 + 简历关联 |
| **Dashboard「今日」** | `/dashboard` | 今日新匹配 + 下一步待办 |
| **结果分析 Insights** | `/insights` | 申请漏斗 + 匹配分↔进面试率 + 简历 A/B + 阶段分布 |
| **文书工坊** | `/writing` | AI 求职信/感谢信/跟进邮件 |
| **谈薪剧本** | `/negotiation` | AI 谈判剧本（中国市场薪酬结构） |

### 2.2 免登录公开工具（获客，`/tools/*`）
简历↔JD 匹配器、幽灵岗/诈骗检测、公司/来源排行榜、`/welcome` 落地页。

### 2.3 管理后台（`/admin/*`，仅 `role=admin`）
概览 / 用户管理 / AI 成本 / 内容运营（岗位下架、用户录入审核）/ 系统健康（队列+成本告警）/ 灰度开关 / 审计。**详见 `admin-panel-readme.md`。**

---

## 3. 关键设计约定（改代码前必读）

- **鉴权以 DB 为准**：`requireUser()` / `requireAdmin()`（`lib/api.ts`）每次从 DB 复核角色/封禁/软删；降权、封禁即时生效。
- **行级隔离**：所有业务查询带 `where: { userId }`。管理员是唯一被授权跨用户读写、绕过隔离的角色，故 `/api/admin/*` 写操作强制落 `AdminAuditLog`。
- **多闸门**：登录后依次过 封禁 → 邮箱验证 → TOS 同意（`(app)/layout.tsx`）。
- **AI 调用记账**：Web 侧同步 AI（文书/谈薪）落 `AiRun`（`lib/ai-log.ts`），在成本看板可见；带用户级限流。公开工具按 IP 限流（`lib/rate-limit.ts`）。
- **打分不调 LLM**：岗位打分/JD 匹配走 embedding + 规则，快且免费。
- **迁移铁律**：一律 `pnpm db:migrate`（migrate dev），**别用 `db push`**（历史漂移已 baseline 修复过一次）。

---

## 4. 测试与 CI

| 层 | 命令 | 覆盖 |
|---|---|---|
| 快速单元/契约 | `pnpm test` | 53 例：归一化/JD 契约/简历 schema/个人信息注入/PII 脱敏/格式化 + **门禁分支（mock）** |
| **DB 集成** | `pnpm test:db` | 4 例：真实 Postgres 上的**行级隔离** + getInsights（独立临时库，自动建/删） |
| 静态 | `pnpm -r typecheck`、`pnpm --filter web lint` | 全包类型 + web eslint |
| CI | `.github/workflows/ci.yml` | push/PR 自动跑上述全部 + 迁移在全新库干净应用 |

细节与"如何加测试"见 `testing-guide.md`。

---

## 5. 本地运行

```bash
pnpm install
pnpm --filter @careeros/db generate     # schema 变更后
pnpm --filter @careeros/db migrate:dev  # 首次/迁移
pnpm dev            # web（默认 3000，本项目 launch 配置用 careeros-web）
pnpm dev:worker     # worker（岗位轮询 + AI 队列 + 成本告警定时器需要它）
```
需要的服务：Postgres（带 pgvector）、Redis、S3/MinIO。造管理员：`UPDATE ...users SET role='admin' WHERE email=...`。

---

## 6. 已知限制 / 待办（诚实清单）

**功能类**
- **i18n 部分**：新功能页（申请/Insights/文书/谈薪/monitor 新增）已支持 zh + en；**其余 9 语言（ja/ko/de/es/fr/it/pt/ru）对这些新功能显示英文兜底**，未全译。admin 后台故意只中文（内部工具）。
- **Insights 子项待数据**：简历 A/B 已可用（需在申请里关联简历）；内推效果、48h、关键词-面试相关性等需更大申请样本才有统计意义，未做。
- **校准阈值需标定**：发现岗位打分 band（`scoreDiscovered.ts` 的 0.10–0.32）与画像校准判定阈值（强≥60、too_strict/too_broad 触发条件）是**小样本估的**，已集中+注释，等真实数据回归调优。
- **零散半成品**：灰度开关（`isFeatureEnabled` 基建就绪但暂无业务消费者）、文书/谈薪草稿不持久化（即用即走）、Kanban 列内拖拽排序（`position` 字段闲置）、硬门槛薪资地板（薪资文本非结构化，未做）。

**AI/成本**
- **文书/谈薪用 `deepseek-v4-flash`**（3–5s）；成本告警仅 webhook（邮件待接 Resend）。

**测试盲区**
- DB 集成测试目前只覆盖**行级隔离核心**；jobMatch 全链路（需 pgvector+embedding）、各路由端到端未覆盖。门禁用 mock 覆盖，未在真实 session 下 E2E。
- 无 Playwright E2E（拖拽、AI 生成等交互靠人工/脚本验证）。

**运维**
- 迁移历史曾有 `db push` 漂移，已 baseline 修复；**务必继续用 migrate dev**。
- 演示数据：dev 库里有若干演示申请/评分/关联（为让 Insights/Kanban 有内容），非生产数据。

---

## 7. 关联文档

- `admin-panel-plan.md` / `admin-panel-readme.md` — 管理后台设计与交接
- `competitor-searchsteward.md` — 竞品调研 + 移植路线图（A–G + Writing/Insights 全部 ✅，含每项落地位置）
- `multi-region-resume-plan.md` — 多地区简历架构（hy3 执行项）
- `testing-guide.md` — 测试体系与扩展指南
