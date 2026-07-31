# CareerOS 开发管理面板（Admin Panel）开发计划书

> 版本：v1.1 ｜ 日期：2026-07-29 ｜ 作者：WorkBuddy
> **v1.1 决策定稿（2026-07-29）**：D1 只做单一 `admin` 全权后台（不做 recruiter/enterprise）；D2 本期**不做**模拟登录 impersonation（保留为后续项）。范围已冻结。
> 代码基线：`packages/db/prisma/schema.prisma`、`apps/web/src/lib/api.ts`、`apps/web/src/lib/auth.ts`、`apps/web/src/middleware.ts`、`apps/web/src/app/(app)/layout.tsx`、`apps/worker/src/index.ts`
> 关联文档：`docs/multi-region-resume-plan.md`（数据模型/行级隔离约定）、`docs/competitor-searchsteward.md` §5.3（内容合规/幽灵岗下架）、`docs/testing-guide.md`（测试）

---

## 0. 摘要（TL;DR）

CareerOS 目前**只有面向普通用户的应用**（`(app)/dashboard|profile|resumes|monitor|...`），**没有任何管理员后台**。但数据库其实已经为管理预留了地基：`UserRole` 枚举含 `admin`，`User.role` 已落库，`requireUser()` 已返回 `role`，`AiRun` 审计表完整记录了每次 AI 调用的成本/token/延迟/失败。缺的是「一个只有管理员能进、能看全局、能管人管内容管系统」的面板。

本计划书给出一套**增量、可分期**的 Admin Panel 架构：

1. **鉴权**：新增 `requireAdmin()`（DB 复核角色，不信任可能过期的 JWT）+ 独立 `/admin` 路由组 + 服务端 layout 门禁。
2. **概览**：全局指标（用户/AI 成本/队列/抓取源/错误率）。
3. **用户管理**：检索、改角色、软删/恢复、封禁、PII 脱敏查看。
4. **AI 用量与成本**：聚合 `AiRun`（按 kind/model/user/时间），成本趋势 + 失败率 + 慢请求。
5. **内容运营**：抓取岗位审核/下架（幽灵岗诈骗）、来源健康与开关。
6. **系统健康**：BullMQ 队列状态、embedding 覆盖、迁移状态。
7. **审计**：新增 `AdminAuditLog`，所有管理写操作留痕 + 破坏性操作二次确认。

全程复用既有 `requireUser` 会话体系与行级隔离约定；管理员的跨用户读写是**唯一被授权绕过行级隔离的入口**，因此鉴权与审计是本计划的最高优先级。

---

## 1. 背景与目标

### 1.1 问题
- 运维/运营目前只能直连数据库或看日志，**没有安全、可审计、非工程师也能用的管理入口**。
- AI 成本（DeepSeek 调用）已被 `AiRun` 记录，但**无人看得见**——无成本看板、无异常告警、无失败率视图。
- 抓取岗位可能含幽灵岗/诈骗（见 searchsteward §5.3），但**无下架/审核入口**。
- 用户支持（改角色、封禁、找回、软删恢复）**只能手工改库**，高危且无留痕。

### 1.2 目标
- G1：管理员（`role=admin`）可通过 `/admin` 进入独立后台，普通用户无入口、直接 403。
- G2：概览页一屏看清关键健康指标（用户、AI 成本、队列、源、错误）。
- G3：用户管理——检索/筛选、查看（PII 脱敏）、改角色、软删/恢复、封禁，全部留痕。
- G4：AI 成本与用量看板——按 kind/model/user/时间聚合，含失败率与慢请求。
- G5：内容运营——抓取岗位审核下架、来源健康与开关。
- G6：系统健康——BullMQ 队列可视化、embedding/迁移状态。
- G7：所有管理写操作写 `AdminAuditLog`，破坏性操作二次确认。

### 1.3 非目标（本期不做）
- 不做面向 `recruiter`/`enterprise` 的**独立业务后台**（枚举已预留，但本期只落 `admin` 全权，见 §7-D1）。
- **不做模拟登录 impersonation**（本期冻结，见 §7-D2；技术上后续可补）。
- 不做实时告警/on-call 集成（PagerDuty 等）——先看板，告警后置。
- 不做计费/发票系统（成本仅内部可见，非对客账单）。
- 不做面板内直接改 schema/跑迁移（迁移仍走 `pnpm db:migrate`）。

---

## 2. 现状核对（基于对代码的核对，2026-07-29）

### 2.1 承重墙：已具备 ✅

| 能力 | 位置 | 说明 |
|---|---|---|
| 角色枚举含 admin | `schema.prisma:14-22` `UserRole` | `guest / user / recruiter / admin / enterprise` |
| 用户已带角色 | `schema.prisma:166` `User.role @default(user)` | 默认 user，可升 admin |
| 鉴权已返回角色 | `apps/web/src/lib/api.ts:17-40` `requireUser()` | 返回 `{ userId, role }` |
| 会话已携带角色 | `apps/web/src/lib/auth.ts:47,54` + `types/next-auth.d.ts:7` | JWT `token.role` ← DB，`session.user.role` 暴露 |
| AI 审计完整 | `schema.prisma:688-712` `AiRun` | `kind/model/tokensIn/Out/costUsd(Decimal)/latencyMs/status/error`，索引 `(userId,createdAt)`、`(kind,status)` |
| AI 调用分类 | `schema.prisma:116` `AiRunKind` | 8 类：resume_parse/jd_parse/resume_generate/profile_generate/worklog_summarize/job_match/skill_extract/translate |
| 队列基础设施 | `apps/worker/src/index.ts:26,52,65` | BullMQ：主 Worker + watchWorker + watchQueue（ioredis 连接） |
| 软删除约定 | `schema.prisma` `User.deletedAt` 等 | 已有软删字段，管理删除应优先软删 |
| 对象存储 | `bullmq` + `@aws-sdk/client-s3`（web/worker） | 简历 PDF/照片走 S3/MinIO |

> 结论：**RBAC 地基和审计数据都已就位**，本期不需要重构鉴权或加埋点，主要是「建后台壳 + 门禁 + 聚合展示 + 写操作留痕」。

### 2.2 缺口（要补的）

1. **无 admin 路由/页面**：`(app)/` 下无 admin 目录，`find` 无任何 admin 页。
2. **无 `requireAdmin()`**：`requireUser` 只做登录校验，未按角色分流；且返回的 `role` 取自 `session`（JWT），**改角色后不重登会过期**——管理门禁必须 DB 复核。
3. **middleware 不做角色门禁**：`middleware.ts:6` 仅 `PUBLIC_PATHS=["/login","/api/auth"]` 的登录 gate，edge runtime 无 Prisma，**无法在此判角色**——admin 细粒度门禁须放服务端 layout + 每个 `/api/admin` route。
4. **无审计日志模型**：没有记录「谁对谁做了什么管理操作」的表。
5. **AI 成本无出口**：`AiRun` 有数据但无任何聚合 API/UI。
6. **队列无可视化**：BullMQ 有队列但无监控面板。
7. **无内容审核入口**：`DiscoveredJob` 无下架/标记 UI（`status` 枚举有 new/viewed/imported/dismissed，但无「管理员下架」态）。

---

## 3. 目标架构

### 3.1 鉴权与访问控制（最高优先级）

**`requireAdmin()`（新增，`apps/web/src/lib/api.ts`）**：
```ts
// 复用 requireUser 的 session 提取，但角色一律从 DB 复核（JWT 可能过期）。
export async function requireAdmin(): Promise<{ userId: string }> {
  const { userId } = await requireUser();
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { role: true, deletedAt: true } });
  if (!u || u.deletedAt || u.role !== "admin") throw new ApiError(403, "forbidden", "需要管理员权限");
  return { userId };
}
```

**三层门禁**（纵深防御）：
1. **middleware**（已有）：只保证已登录，不判角色（edge 限制）。
2. **`app/admin/layout.tsx`（服务端组件）**：进入任何 `/admin/*` 页前 `requireAdmin()`，非 admin → `redirect("/dashboard")` 或 403 页。普通用户导航**不渲染** admin 入口。
3. **每个 `/api/admin/*` route handler**：入口 `await requireAdmin()`，杜绝绕过 UI 直接打 API。

> 关键安全约定：管理员是**唯一被授权跨用户读写、绕过行级隔离**的角色。因此 ① 所有 `/api/admin` 写操作必须落 `AdminAuditLog`；② 破坏性操作（删用户、下架、改角色）需二次确认；③ 读取用户 PII 时敏感字段（`weknoraApiKey`、证件号等）默认脱敏。

### 3.2 面板模块矩阵

| 模块 | 页面 | 数据来源 | 关键动作 |
|---|---|---|---|
| **概览 Overview** | `/admin` | 聚合多表 | 只读指标卡 + 趋势 |
| **用户 Users** | `/admin/users`、`/admin/users/[id]` | `User` + 关联计数 | 改角色、软删/恢复、封禁、查看（脱敏） |
| **AI 成本 Usage** | `/admin/usage` | `AiRun` 聚合 | 按 kind/model/user/日期分组、失败率、慢请求、单 run 详情 |
| **内容运营 Content** | `/admin/jobs` | `DiscoveredJob`/`JobDescription` | 审核、下架（诈骗/幽灵岗）、来源开关 |
| **系统健康 System** | `/admin/system` | BullMQ + Prisma 元数据 | 队列计数、重试/清理、embedding 覆盖、迁移状态 |
| **审计 Audit** | `/admin/audit` | `AdminAuditLog` | 只读检索（谁/何时/对谁/做了什么） |

### 3.3 数据模型新增（Prisma）

```prisma
// 管理操作审计（所有 /api/admin 写操作落一条）
enum AdminAction {
  user_role_change
  user_soft_delete
  user_restore
  user_ban
  job_takedown
  source_toggle
  other

  @@map("admin_action")
}

model AdminAuditLog {
  id         String      @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  actorId    String      @map("actor_id") @db.Uuid          // 执行操作的管理员
  action     AdminAction
  targetType String      @map("target_type") @db.VarChar(32) // "user" | "discovered_job" | ...
  targetId   String?     @map("target_id") @db.Uuid
  before     Json?                                           // 变更前快照（脱敏）
  after      Json?                                           // 变更后快照（脱敏）
  reason     String?     @db.VarChar(500)                    // 管理员填写的原因
  ip         String?     @db.VarChar(64)
  createdAt  DateTime    @default(now()) @map("created_at") @db.Timestamptz()

  actor User @relation("AdminActor", fields: [actorId], references: [id])

  @@index([actorId, createdAt(sort: Desc)])
  @@index([targetType, targetId])
  @@map("admin_audit_logs")
}
```
> `User` 需加反向关系 `adminActions AdminAuditLog[] @relation("AdminActor")`。可选：`DiscoveredJob` 增 `takenDownAt/takenDownBy` 或复用 `status` 加一个 `taken_down` 态（见 §7-D5）。

### 3.4 API 设计（`/api/admin/*`，全部 `requireAdmin` 前置）

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/admin/overview` | 概览聚合（缓存 30–60s） |
| GET | `/api/admin/users?q=&role=&status=&page=` | 用户检索（分页、脱敏） |
| GET | `/api/admin/users/:id` | 用户详情 + 关联计数 |
| PATCH | `/api/admin/users/:id/role` | 改角色（落审计） |
| POST | `/api/admin/users/:id/soft-delete` \| `/restore` \| `/ban` | 状态操作（落审计 + 二次确认） |
| GET | `/api/admin/usage?groupBy=kind\|model\|user&from=&to=` | AiRun 聚合 |
| GET | `/api/admin/usage/runs?status=failed&...` | 单次 run 明细 |
| GET | `/api/admin/jobs?source=&flagged=` | 抓取岗位列表 |
| POST | `/api/admin/jobs/:id/takedown` | 下架（落审计） |
| GET | `/api/admin/system/queues` | BullMQ 队列计数 |
| POST | `/api/admin/system/queues/:name/retry-failed` | 重试失败任务（落审计） |
| GET | `/api/admin/audit?actor=&target=&action=` | 审计检索 |

### 3.5 队列可视化方案
- **推荐 P1 先集成 [bull-board](https://github.com/felixmosh/bull-board)**：挂在 `/admin/system/queues` 下、**必须过 `requireAdmin` 反代**（bull-board 默认无鉴权，严禁裸挂），快速可用。
- 若需与后台 UI 风格统一，后续用 BullMQ `queue.getJobCounts()` 自建卡片（可控但要自己写重试/清理）。见 §7-D3。

### 3.6 架构与门禁数据流（mermaid）

```mermaid
flowchart TD
  U[浏览器] -->|/admin/*| MW[middleware：仅判登录]
  MW -->|已登录| L[admin/layout.tsx]
  L -->|requireAdmin：DB 复核 role| RA{role==admin?}
  RA -->|否| RD[redirect /dashboard / 403]
  RA -->|是| P[Admin 页面]

  P -->|fetch| API[/api/admin/*]
  API -->|requireAdmin| G{通过?}
  G -->|否| E403[403]
  G -->|是· 读| DB[(Prisma 跨用户读·脱敏)]
  G -->|是· 写| W[写操作]
  W --> DB
  W ==>|必须留痕| AL[(AdminAuditLog)]

  DB -.AiRun 聚合.-> USAGE[AI 成本看板]
  Q[(BullMQ/Redis)] -.队列计数.-> SYS[系统健康]
```

---

## 4. 实施路线图

> 人天为单人粗估（含联调自测），KPI 为可观测验收。

### P0 — 门禁 + 概览 + AI 成本（约 1.5–2 周）✅ 已完成（2026-07-29，浏览器实测通过）
| 项 | 内容 | 人天 | KPI |
|---|---|---|---|
| P0-1 | `requireAdmin()`（DB 复核）+ `app/admin/layout.tsx` 服务端门禁 + 403 页；普通用户无入口 | 2d | 非 admin 访问 `/admin/*` 与 `/api/admin/*` 均被拒（redirect / 403） |
| P0-2 | `AdminAuditLog` 模型 + migration + 写工具函数 `logAdminAction()` | 1–2d | 迁移通过；写操作可落一条含 before/after |
| P0-3 | 概览页 `/admin` + `/api/admin/overview`（用户数/活跃、今日/本月 AI 成本、队列积压、失败率） | 3d | 一屏显示 6+ 指标，数值与库一致 |
| P0-4 | AI 成本看板 `/admin/usage`（按 kind/model/时间聚合 + 失败率 + 慢请求 Top） | 3–4d | 成本合计与 `sum(AiRun.costUsd)` 一致；可切换分组维度 |

**P0 验收**：管理员能进后台看到全局健康与 AI 成本；非管理员完全进不来。

### P1 — 用户管理 + 内容运营 + 队列（约 2–3 周）✅ 已完成（2026-07-29，浏览器实测通过）
| 项 | 内容 | 人天 | KPI |
|---|---|---|---|
| P1-1 | 用户列表/详情（检索、筛选 role/status、关联计数、PII 脱敏） | 4d | 可按邮箱/角色/状态检索；敏感字段不明文 |
| P1-2 | 用户写操作（改角色/软删/恢复/封禁）+ 二次确认 + 落审计 | 3d | 每次写操作产生 1 条 `AdminAuditLog`；软删可恢复 |
| P1-3 | 内容运营：抓取岗位列表 + 下架（诈骗/幽灵岗）+ 来源开关 | 3–4d | 下架后该岗位不再进用户 feed；操作留痕 |
| P1-4 | 系统健康：集成 bull-board（`requireAdmin` 反代）+ embedding/迁移状态卡 | 2–3d | 队列 waiting/active/failed 可见；bull-board 不可裸访问 |
| P1-5 | 审计检索页 `/admin/audit` | 1–2d | 可按 actor/target/action 过滤 |

**P1 验收**：管理员可安全管人、下架违规内容、看队列，全程留痕。

### P2 — 增强（约 1 周，视需要）✅ 已完成（2026-07-29，浏览器实测通过）
| 项 | 内容 | 人天 | KPI |
|---|---|---|---|
| P2-1 | 成本异常告警（阈值触发邮件/webhook） | 2–3d | 超阈值触发一次通知 |
| P2-2 | Feature Flag 管理（灰度开关） | 2–3d | 开关即时生效、可回滚 |

> 模拟登录 impersonation 本期**冻结不做**（见 §7-D2）。若将来客服排障需要，再作为独立增强项引入（带时限 + 强审计 + 顶部横幅）。

---

## 5. 风险与前提

1. **权限提升是最高风险**：admin 绕过行级隔离读写全体数据。措施——`requireAdmin` **DB 复核**（不信任 JWT）、三层门禁、所有写操作落审计、破坏性操作二次确认。
2. **JWT 角色过期**：改角色后用户 session 里的 `role` 到下次重登才更新。门禁一律以 DB 为准；降权（admin→user）应能即时生效（DB 复核保证）。
3. **PII 暴露面扩大**：后台能看全体用户数据。措施——敏感字段默认脱敏、按需展开且展开动作也留痕、审计快照本身脱敏。
4. **bull-board 裸挂 = 未授权运维入口**：务必置于 `requireAdmin` 之后，切勿直接暴露端口。
5. **破坏性操作**：删除优先软删（`deletedAt`）、下架可撤销；硬删除不在本期。
6. **审计不可篡改**：`AdminAuditLog` 只增不改不删（面板不提供编辑/删除审计的入口）。
7. **测试**：门禁与审计属安全关键路径，须补集成测试（`requireAdmin` 放行/拒绝、写操作必落审计），见 `docs/testing-guide.md` §5/§6（DB 层）。

---

## 6. 验收标准（总表）

| # | 标准 | 验证方式 |
|---|---|---|
| 1 | 非 admin 访问 `/admin/*` 被 redirect/403；`/api/admin/*` 返回 403 | 跨角色请求 + 集成测试 |
| 2 | admin 降权为 user 后，即时失去后台访问（无需重登） | 改库后立即请求 |
| 3 | 概览指标与数据库一致（用户数、成本合计） | 与 `count`/`sum` 对拍 |
| 4 | AI 成本可按 kind/model/时间聚合，失败率正确 | 与 `AiRun` 聚合对拍 |
| 5 | 每个管理写操作产生 1 条 `AdminAuditLog`（含 before/after/actor） | 操作后查审计表 |
| 6 | 用户 PII 敏感字段默认脱敏 | 详情页/接口响应核对 |
| 7 | 岗位下架后不再进用户 feed | 下架前后对比 monitor feed |
| 8 | bull-board 仅管理员可达 | 未登录/普通用户访问被拒 |
| 9 | 门禁与审计集成测试全绿 | `pnpm test`（见 testing-guide） |
| 10 | `pnpm -r typecheck` 0 错、`pnpm --filter web lint` 0 error | CI |

---

## 7. 决策备忘 / 开放问题

- **D1（已定 2026-07-29）· RBAC 粒度**：本期只做**单一 `admin` 全权后台**，不做 `recruiter`/`enterprise` 后台。枚举已预留，后续按需扩。
- **D2（已定 2026-07-29）· Impersonation 模拟登录**：本期**不做**。理由：产品早期、客服排障压力未到，而它是最大安全口子。保留为后续独立增强项，技术上随时可补。
- **D3 · 队列面板**：集成 **bull-board**（快，但风格不统一、需鉴权反代）vs 自建卡片（可控、统一 UI，但要自写重试/清理）。建议 **P1 先 bull-board**。
- **D4 · 审计模型**：新增 `AdminAuditLog`（**推荐必做**，P0 就落，否则 P1 的写操作无处留痕）。
- **D5 · 岗位下架建模**：给 `DiscoveredJob` 加 `taken_down` 状态/字段 vs 新增独立下架表。建议**复用 `status` 加一态 + `takenDownBy/At`**，最省。
- **D6 · 面板技术栈**：沿用现有 Next.js App Router + 现有 UI 组件（`components/ui/*`）+ `useT` i18n，不引入新框架。

---

_附录：本计划所有代码位置均经 2026-07-29 核对（schema.prisma / api.ts / auth.ts / middleware.ts / worker/index.ts）。RBAC 地基（`UserRole.admin`、`requireUser` 返回 role、`session.user.role`）与 AI 审计（`AiRun`）为既有承重墙，本期在其上做增量。_
