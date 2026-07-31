# CareerOS 管理后台 · 交接说明书

> 版本：v1.0 ｜ 日期：2026-07-29 ｜ 面向：接手维护/扩展的开发者（hy3）
> 配套：`docs/admin-panel-plan.md`（设计计划书，P0/P1/P2 全部标记已完成）

管理后台是一个只有 `role=admin` 能进的独立后台，挂在 `/admin/*`，与用户应用 `(app)/*` 完全分离。P0+P1+P2 全部落地并浏览器实测通过。

---

## 1. 访问控制（最重要）

管理员是**唯一被授权跨用户读写、绕过行级隔离**的角色，因此门禁是三层纵深防御，且**角色一律以数据库为准**（不信任可能过期的 JWT）：

1. **middleware**（`apps/web/src/middleware.ts`）：只保证已登录（edge runtime 无 Prisma，判不了角色）。
2. **`app/admin/layout.tsx`**：进任何 `/admin/*` 前 `isActiveAdmin(userId)`（DB 复核 role + 未软删），非 admin → `redirect("/dashboard")`。
3. **每个 `/api/admin/*` route**：入口 `await requireAdmin()`（同样 DB 复核），杜绝绕过 UI 直接打接口。

关键函数在 `apps/web/src/lib/api.ts`：
- `isActiveAdmin(userId)` — role===admin 且未软删。
- `requireAdmin()` — 非管理员抛 403。
- `requireUser()` — 已扩展：**封禁/软删用户即时被拒**（`bannedAt`/`deletedAt` 非空 → 403/401）。

> 降权即时生效：把某人 role 从 admin 改回 user，其下一次请求就进不了后台，无需等 JWT 过期。
> 侧边栏的「管理后台」入口用的是 session 里的 role（登录时写入），仅控制**入口显隐**；真正的拦截永远是 DB 复核。

---

## 2. 模块地图

侧边栏（`components/admin-sidebar.tsx`）7 个模块，均为服务端组件直查 + `force-dynamic`：

| 模块 | 路由 | 页面 | 数据/接口 |
|---|---|---|---|
| 概览 | `/admin` | `app/admin/page.tsx` | `lib/admin/metrics.ts` `getOverviewMetrics` |
| 用户 | `/admin/users`、`/users/[id]` | 列表/详情 | `lib/admin/users.ts`；写操作 `api/admin/users/[id]/action` |
| AI 成本 | `/admin/usage` | `app/admin/usage/page.tsx` | `getUsageMetrics`（AiRun 聚合） |
| 内容运营 | `/admin/jobs` | `app/admin/jobs/page.tsx` | `lib/admin/jobs.ts`；下架 `api/admin/jobs/takedown` |
| 系统健康 | `/admin/system` | `app/admin/system/page.tsx` | `lib/admin/system.ts`；重试 `api/admin/system/retry-failed`；含成本告警配置区 |
| 灰度开关 | `/admin/flags` | `app/admin/flags/page.tsx` | `lib/admin/flags.ts`；`api/admin/flags`(+`/[id]`) |
| 审计 | `/admin/audit` | `app/admin/audit/page.tsx` | `lib/admin/audit.ts` `listAuditLogs` |

也提供两个只读 JSON 接口（`requireAdmin` 门禁）：`api/admin/overview`、`api/admin/usage`。

---

## 3. 数据模型（本项目新增）

`packages/db/prisma/schema.prisma`：
- `AdminAuditLog` + `AdminAction` 枚举 — 管理操作审计，只增不改不删。
- `User.bannedAt` — 封禁（鉴权层即时拒绝）。
- `DiscoveredJob.takenDownAt` / `takenDownById` — 岗位下架。
- `FeatureFlag` — 灰度开关（`enabled` + `rolloutPercent`）。
- `AlertConfig`（单例 `id="cost"`）— 成本告警配置。

**审计**：所有管理写操作必须调 `logAdminAction()`（`lib/admin/audit.ts`），落 before/after 快照 + actor + reason，且传入前**先脱敏**。

---

## 4. 审计与安全约定

- **写操作必留痕**：改角色/软删/恢复/封禁/解封、岗位下架、队列重试、开关变更、告警配置，都会写一条 `AdminAuditLog`。
- **破坏性操作二次确认**：前端 `window.confirm`（用户/岗位/重试操作组件）。
- **自我保护**：管理员不能对自己改角色/封禁/软删（`api/admin/users/[id]/action` 里 `id===actorId → 400`）。
- **PII 脱敏**：`lib/admin/mask.ts`（`maskEmail`/`maskSecret`）；用户详情不回显 `weknoraApiKey` 等密钥，只显示「已配置」。
- **软删优先**：删除用 `deletedAt`（可恢复），本期无硬删。

---

## 5. 两个 P2 能力怎么用

**灰度开关**：`/admin/flags` 创建/启用/放量。业务代码里判定：
```ts
import { isFeatureEnabled } from "@/lib/feature";
if (await isFeatureEnabled("new_dashboard", userId)) { /* 命中灰度 */ }
```
`enabled` 为前提；`rolloutPercent<100` 时按 `(key:userId)` 稳定哈希分桶放量；无 userId 上下文时灰度中的 flag 视为关闭。改动即时生效、可回滚。

**成本告警**：`/admin/system` 底部配置区。设「日阈值(USD)」+「Webhook URL」+启用。
- 判定逻辑 `packages/db/costAlert.ts` `runCostAlertCheck(prisma)`，**web 的「立即检查」与 worker 定时任务共用同一份**。
- 定时：worker 每小时检查一次（`apps/worker/src/index.ts` 的 `cost-alert-scheduler`），当日成本 ≥ 阈值且当天未发过 → POST webhook（Slack 兼容 `{text}`）并记 `lastFiredOn`，**当日只通知一次**。
- 定时依赖 worker 进程：`pnpm dev:worker`。web 不跑 worker 也能用「立即检查」当场验证。

---

## 6. 本地运行与验证

```bash
# 依赖 + Prisma Client（首次/schema 变更后）
pnpm install
pnpm --filter @careeros/db generate

# 起 web（用 launch 配置 careeros-web，或）
pnpm dev            # web
pnpm dev:worker     # worker（成本告警定时器需要它）

# 质量门
pnpm -r typecheck
pnpm --filter web lint
pnpm test           # vitest 契约层集成测试（见 docs/testing-guide.md）
```

**造一个管理员**（开发库）：登录任意邮箱后，把该用户 role 改成 admin：
```sql
UPDATE careeros.users SET role='admin' WHERE email='you@example.com';
```
（生产走正常账号体系；`UserRole` 枚举含 guest/user/recruiter/admin/enterprise，本期只用 admin。）

---

## 7. 数据库迁移（务必看）

- 迁移历史曾有**漂移**（早期 `db push` 让 `career_profiles.personal` 等进库却不进迁移）。已用 baseline 迁移 `20260729000000_reconcile_personal_and_admin_audit` 收拾干净——现在**全新库 `migrate deploy` 全部迁移能精确重建当前 schema**（已用「dev 库 vs 全新 deploy 库」空 diff 验证）。
- 之后 P1/P2 的改动都是正常 `migrate dev` 生成的迁移。
- **上线**：`pnpm --filter @careeros/db migrate:deploy` 即可。
- **铁律：这个项目别再用 `db push`**，一律 `migrate dev`，否则会再攒漂移。

---

## 8. 如何加一个新的 admin 模块（扩展模板）

1. 数据函数放 `lib/admin/<模块>.ts`（服务端直查 Prisma）。
2. 页面 `app/admin/<模块>/page.tsx`（服务端组件 + `export const dynamic = "force-dynamic"`）。
3. 写操作走 `app/api/admin/<模块>/.../route.ts`，入口 `await requireAdmin()`，**写完调 `logAdminAction()`**，破坏性操作前端加确认。
4. 交互控件放 `components/admin/*.tsx`（`"use client"`，fetch + `router.refresh()`）。
5. 侧边栏 `components/admin-sidebar.tsx` 的 `NAV` 加一项（`live: true`）。
6. 过 `pnpm -r typecheck` + `pnpm --filter web lint`。

---

## 9. 已知取舍 / 待办

- **岗位下架是全局的**：按 `(source, externalId)` 跨所有用户生效（诈骗/幽灵岗对谁都是坏的）；下架后不进任何用户 feed（`api/v1/discovered-jobs` 已加 `takenDownAt: null` 过滤）。
- **队列面板是自建的**（非 bull-board）：`getJobCounts` + 失败任务列表 + 重试失败，统一 UI；重试会真正 re-enqueue（会重跑真实任务，谨慎）。
- **告警仅 webhook**：邮件通道待接 Resend（auth.ts 里已留位）。
- **未做**：模拟登录 impersonation（P2 冻结，见计划书 §7-D2）；recruiter/enterprise 独立后台（枚举预留）。
- **`unban` 审计动作**用的是 `other`（枚举无 unban），reason 里区分。
