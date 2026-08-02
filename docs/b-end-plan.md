# CareerOS B 端（雇主发岗）实施计划书

> 版本：v2 · 2026-08-02 · 状态：**阶段 1-4 已实施并全链路验证通过**（验收清单见 §10，全部勾选）
> 范围：posting-only 雇主端（只发岗，不搜候选人、不做协作）
>
> **v2 修订说明**：v1 的三条「实现前需核对」项经代码核对后**全部为假**（角色枚举、categories 类型、auth 文件路径），
> 且「并入 C 端岗位流」在当前架构下不成立（岗位流是每用户私有的）。v2 逐条修正，见 §13。

---

## 1. 背景与目标

- **现状**：CareerOS 目前是 C 端个人职业工具——简历/ATS PDF 生成 + 岗位监测聚合（`DiscoveredJob`，已接入 271 个外部来源）。
- **目标**：引入 B 端能力，允许 **HR 个人 / 创业公司 / 创业团队** 发布招聘岗位，让求职者在站内发现。
- **首期定位**：**posting-only 雇主端**——只发岗，不做候选人搜索、不做协作/团队管理。

### 与 `B端招聘发布计划书.md` 的关系

仓库另有一份 239 行的完整版计划书（Company / CompanyMember / JobPost / JobApplication + 公司主页 + 站内投递 + AI 辅助）。
两者**不是替代关系**：

- 本文档（posting-only）是**第一步**，落地「有人能发岗、有人能看到」的最小闭环，不引入组织实体。
- 完整版是**后续演进方向**：等有真实发布量后再补 `Organization`/`Company`（`JobPosting.orgId` 已预留可空外键位）与站内投递。
- **冲突点已消除**：完整版的 `JobPost` 与本文档的 `JobPosting` 是同一件事的两代设计，**以本文档为准**；未来演进是给 `JobPosting` 挂 `orgId`，而不是新建 `JobPost` 表。

---

## 2. 范围界定

### ✅ 首期包含（In）
- 三类发布者：HR 个人、创业公司、创业团队
- 发岗表单 + 岗位入库（`JobPosting`）+「我的发布」管理（下架/重开）
- 发布岗位进入 C 端「在招岗位」列表（「站内发布」徽标 + 「企业招聘」来源筛选）
- **接入现有审核流**：发布默认 `pending`，管理员过审后才对外可见（见 §8）

### ❌ 首期排除（Out）
- 搜候选人 / 反向人才库 / 授权发现（→ 无候选人隐私 / GDPR 坑）
- 协作 / 团队管理 / 多成员权限矩阵
- 站内申请（仅外链 `url`）、企业主体认证、组织实体（`Organization`/`Company`）

---

## 3. 角色模型（**复用已有枚举，不新增**）

`schema.prisma:14` 的 `UserRole` **早已预留 B 端角色**：

```prisma
enum UserRole { guest user recruiter admin enterprise }  @@map("user_role")
```

- **`recruiter` = 可发岗**，直接复用，零迁移。`enterprise` 留给将来的企业主体（有组织实体后才启用）。
- ~~新增 `CANDIDATE` / `EMPLOYER`~~（v1 方案）——会撞 `admin/users/[id]/action` 的 `set_role` zod 枚举、`isActiveAdmin()`、authz 测试，已废弃。
- 单用户可同时是求职者与招聘者：`recruiter` 保留全部 C 端功能，只是多出发岗入口。
- 自助切换：设置页开关在 `user ↔ recruiter` 之间切，**不触碰 `admin`/`enterprise`**（防止管理员误降权）。

---

## 4. 数据模型（Prisma）

**必须对齐全库风格**：`uuid` 主键 + snake_case `@map` + `@@map` + `@db.Timestamptz()` + `@db.VarChar(n)`。
v1 的 `cuid()` / `String[]` / `@db.Text` / 无 map 是另一套风格，且 `postedByUserId String` 不带 `@db.Uuid` 会因外键类型不匹配**直接迁移失败**。

```prisma
enum OrgType {
  individual_hr        // HR 个人
  startup              // 创业公司
  non_company_team     // 创业团队（未注册主体）
  enterprise           // 预留：大型企业，首期表单不可选

  @@map("org_type")
}

enum JobPostingStatus {
  draft
  open
  closed

  @@map("job_posting_status")
}

model JobPosting {
  id             String           @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  postedByUserId String           @map("posted_by_user_id") @db.Uuid
  orgId          String?          @map("org_id") @db.Uuid   // 预留：将来接 Organization，历史岗不迁移
  orgType        OrgType          @map("org_type")
  company        String           @db.VarChar(128)          // 展示用公司/团队名
  title          String           @db.VarChar(200)
  location       String?          @db.VarChar(128)
  salary         String?          @db.VarChar(64)
  description    String                                      // 完整 JD 文本
  url            String?                                     // 外链申请地址；空则展示联系方式引导
  categories     Json             @default("[]")             // 与 DiscoveredJob 完全一致的 Json 数组
  status         JobPostingStatus @default(draft)
  // 治理：复用 DiscoveredJob 同款审核流与下架能力
  reviewStatus   JobReviewStatus  @default(pending) @map("review_status")
  reviewedAt     DateTime?        @map("reviewed_at") @db.Timestamptz()
  reviewedById   String?          @map("reviewed_by_id") @db.Uuid
  reviewNote     String?          @map("review_note") @db.VarChar(500)
  takenDownAt    DateTime?        @map("taken_down_at") @db.Timestamptz()
  takenDownById  String?          @map("taken_down_by_id") @db.Uuid
  createdAt      DateTime         @default(now()) @map("created_at") @db.Timestamptz()
  updatedAt      DateTime         @default(now()) @updatedAt @map("updated_at") @db.Timestamptz()
  closedAt       DateTime?        @map("closed_at") @db.Timestamptz()

  postedBy User @relation("PostedJobs", fields: [postedByUserId], references: [id], onDelete: Cascade)

  @@index([status, reviewStatus, createdAt(sort: Desc)])   // 公共流扫描
  @@index([postedByUserId, createdAt(sort: Desc)])         // 「我的发布」
  @@map("job_postings")
}
```

`User` 侧需加反向关系 `jobPostings JobPosting[] @relation("PostedJobs")`，否则 `prisma validate` 不过。

**说明**
- `JobPosting` 为**独立表**，不污染 `DiscoveredJob`（watch 聚合管线零改动）。
- `categories` 是 **`Json @default("[]")`**，与 `DiscoveredJob.categories` 一致——v1 说的 `String[]` 是错的（`String[]` 的是 `JobWatch.matchCategories`）。
- 品类取值只有 **`game / finance / tech / ai`** 四个（`packages/shared/src/watch.ts:6` 的 `JOB_CATEGORIES`），**没有 `general`**（`general` 只是 taxonomy 里 role 的归类字段）。
- 迁移一律 `prisma migrate dev`。仓库有 `migrations/` 目录，**不能用 `db push`**（会破坏迁移历史）。

---

## 5. 认证与门禁（**查 DB，不信 JWT**）

`apps/web/src/lib/auth.ts:201` 的 jwt callback 只在登录那一刻查库写 `token.role`，之后永不刷新。
所以 ~~`session.user.role === EMPLOYER`~~（v1 方案）在「设置页切角色后不重登」的场景下直接失效。

仓库已有正确范式（`api.ts:50` 注释：「角色一律以 DB 为准，不信任 JWT 里的 session.role」）。新增：

```ts
/** 角色门禁：以 DB 为准（JWT 里的 role 在改角色后会滞后），未命中抛 403。 */
export async function requireRole(roles: readonly string[]): Promise<{ userId: string; role: string }> {
  const { userId } = await requireUser();
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { role: true, deletedAt: true } });
  if (!u || u.deletedAt || !roles.includes(u.role)) throw new ApiError(403, "forbidden", "需要招聘者权限");
  return { userId, role: u.role };
}
```

- 发岗接口一律 `requireRole(["recruiter", "enterprise", "admin"])`。
- 页面/导航门控同理走 `(app)/layout.tsx` 里已有的 DB 查询（那里已经在查 `role` 做管理员入口门控，加一个 `isRecruiter` 即可，零额外查询）。
- 设置页「成为招聘者」开关 → `PUT /api/v1/me/role`，只接受 `user ↔ recruiter`。

---

## 6. 发岗流程与 UI

- 路由 `/employer/jobs`（仅 `recruiter`/`enterprise`/`admin` 可见导航入口；页面服务端二次门控，直接访问会 redirect）。
- 表单字段：`orgType`（HR 个人 / 创业公司 / 创业团队，`enterprise` 不可选）、`company`、`title`、`location`、`salary`、`categories`（复用 `JOB_CATEGORIES` 多选）、`description`、`url`（选填）。
- 同页下方是「我的发布」列表：显示审核状态与在招状态，支持**下架（`closed`）/ 重开（`open`）/ 删除草稿**。
- 提交 → `POST /api/v1/job-postings`（`postedByUserId = 当前用户`，`status = open`，`reviewStatus = pending`）。

---

## 7. C 端合流（**v1 的 SQL union 方案不成立，已重设计**）

### 为什么 `DiscoveredJob ∪ JobPosting` 做不了

`DiscoveredJob` **不是公共岗位库，是每用户私有的 feed**：

- 表结构 `watchId → userId` 双挂载，唯一键 `[watchId, source, externalId]`；
- `GET /api/v1/discovered-jobs` 硬性 `where: { userId }`（`route.ts:13`）；
- 连用户手动收录的岗位，都要靠 `lib/user-jobs.ts` 懒建一个私有的「我的收录」watch 才能挂进去。

平台上根本没有「公共岗位流」这个东西。`JobPosting` 是全局的、没有 `userId`，无法 union 进一个按 `userId` 过滤的查询。
硬 union 还有第二个问题：现有排序是 `closedAt → matchScore → createdAt`，而 `JobPosting` 没有 embedding 评分，混排后排序语义崩掉。

### 采用方案：客户端合流

在 `/jobs/active`（在招岗位）并行拉两条源，在前端合并成一个列表：

| 源 | 接口 | 语义 |
|---|---|---|
| 外部抓取 + 我的收录 | `GET /api/v1/discovered-jobs`（既有） | 每用户私有 |
| 企业发布 | `GET /api/v1/job-postings/feed`（新增） | 全局公共，`status=open` + `reviewStatus=approved` + 未下架 |

- 每条带 `origin: "external" | "posted"`；posted 显示 **「站内发布」徽标**。
- 来源筛选 Select 加 **「企业招聘」** 选项（值 `posted`），选中时只显示 posted。
- 排序：两组各自有序后按 `createdAt` 归并；posted 无 `matchScore`，不参与匹配分排序。

**明确不做**：发布时 fan-out 复制到每个用户的 `DiscoveredJob`（数据爆炸 + 污染 watch 唯一键）。

---

## 8. 治理：复用现有审核流（v1 遗漏项）

平台已经有完整的「用户录入岗位」审核链路：`reviewStatus: pending` → `/admin/review` → 通过才进公共统计。
B 端发岗如果不接，就成了**绕过审核的垃圾入口**。因此：

- `JobPosting.reviewStatus` 默认 `pending`，公共流只出 `approved`；发布者在「我的发布」里能看到自己的 `pending`/`rejected` 状态与拒绝理由。
- 新增 `/admin/postings` 审核页（结构照抄 `/admin/review`），`POST /api/admin/postings/review` 走 `logAdminAction({ action: "job_review", targetType: "job_posting" })`。
- `takenDownAt` 支持管理员事后下架（诈骗/幽灵岗），与 `DiscoveredJob` 的下架能力对齐。
- `AdminAction` 枚举**无需新增值**：复用 `job_review` / `job_takedown`，靠 `targetType` 区分。

---

## 9. 分阶段实施计划

### 阶段 1 — Schema + 契约 + 门禁
- Prisma：`OrgType` / `JobPostingStatus` 枚举 + `JobPosting` 模型 + `User.jobPostings` 反向关系；`prisma migrate dev`。
- `packages/shared`：`ORG_TYPES` 常量 + `jobPostingCreateInput` / `jobPostingUpdateInput` zod 契约。
- `api.ts`：`requireRole()`。
- 验收：`job_postings` 表存在；`pnpm typecheck` 过；authz 单测覆盖 `requireRole`。

### 阶段 2 — API + 雇主端
- `/api/v1/job-postings`（GET 我的 / POST 发布）、`/[id]`（PATCH 状态 / DELETE 草稿）、`/feed`（公共流）、`/api/v1/me/role`。
- `/employer/jobs` 页面 + 表单 + 我的发布列表；layout 传 `isRecruiter`，sidebar 条件渲染；设置页角色开关。
- 验收：`recruiter` 发岗成功入库；普通 `user` 访问 `/employer/jobs` 被 redirect、调接口 403。

### 阶段 3 — C 端合流 + 管理端审核
- `/jobs/active` 双源合流 + 「站内发布」徽标 + 「企业招聘」筛选。
- `/admin/postings` 审核页 + 审核/下架接口 + 审计留痕。
- 验收：过审后的岗出现在候选端并带徽标；筛「企业招聘」只剩 posted；未过审的不出现。

### 阶段 4 — 收尾
- i18n（zh-CN + en，其余语言由 `getMessages` 回退 zh-CN，与仓库现状一致）。
- 表单校验/错误态；`draft` 存草稿；`pnpm test` + `pnpm typecheck` + 浏览器全链路实测。

---

## 10. 验收标准（总）

- [x] `recruiter` 可发岗，过审后在候选端「在招岗位」可见（带「站内发布」徽标）
- [x] 普通 `user` 看不到发岗入口、访问 `/employer/jobs` 被 redirect 到 `/settings?employer=1`、直接打接口 403
- [x] 改角色后**不重新登录**也立即生效（DB 权威门禁），升权降权双向实测
- [x] 来源筛选「企业招聘」只显示 posted 岗（501 → 1）
- [x] 未过审 / 已下架 / 已 `closed` 的发布不进候选端
- [x] 三类 `orgType` 均可发（创业公司/HR 个人/创业团队各实测一次）；`enterprise` 表单不可选
- [x] 现有 watch 聚合管线不受影响（`DiscoveredJob` 数据与查询不变，合流后仍为 500 条外部岗）
- [x] 自管理闭环：存草稿 → 发布 → 拒绝（带理由回显）→ 下架 → 重新发布（自动回到待审）→ 删草稿；已发布岗删除被 400 拦下

**测试**：`pnpm test` 67 passed（含 6 条 `requireRole` 用例）；`pnpm test:db` 12 passed（8 条 `job-postings.db.test.ts`，跑在由迁移全新建的库上）；`pnpm -r typecheck` 全过。

---

## 11. 风险与待办

- **反垃圾**：首期靠人工审核兜底；发布量上来后需加频率限制（同一用户 N 条/天）与最低字数校验。
- **站内申请**：当前仅外链 `url`；站内投递（`JobApplication`）留待组织实体落地后一起做。
- **公共流规模**：`/feed` 目前 `take: 200` 全量返回、前端筛选。超过千条量级需改服务端分页 + 关键词检索（`pg_trgm` 已启用）。
- **i18n 覆盖**：9 个非中文语种目前普遍落后（663 键 vs zh-CN 822），本次沿用「补 zh-CN + en，其余回退」的既有做法。

---

## 12. 改动文件

| 文件 | 改动 |
|---|---|
| `packages/db/prisma/schema.prisma` | 新增 2 枚举 + `JobPosting` + `User.jobPostings` |
| `packages/db/prisma/migrations/*` | 新迁移 |
| `packages/shared/src/job-posting.ts` | `ORG_TYPES` + zod 契约（`index.ts` 导出） |
| `apps/web/src/lib/api.ts` | `requireRole()` |
| `apps/web/src/lib/job-postings.ts` | 公共流 / 我的发布查询封装 |
| `apps/web/src/app/api/v1/job-postings/**` | 发岗 / 我的 / 详情 / 公共流 |
| `apps/web/src/app/api/v1/me/role/route.ts` | 自助角色切换 |
| `apps/web/src/app/(app)/employer/jobs/**` | 发岗页 + 表单 + 我的发布 |
| `apps/web/src/app/(app)/jobs/active/page.tsx` | 双源合流 + 徽标 + 来源筛选 |
| `apps/web/src/app/(app)/layout.tsx` | 传 `isRecruiter` |
| `apps/web/src/components/app-sidebar.tsx` | 招聘者导航入口 |
| `apps/web/src/app/(app)/settings/*` | 「成为招聘者」开关 |
| `apps/web/src/lib/admin/jobs.ts` | 发布审核队列 + 审核/下架函数 |
| `apps/web/src/app/admin/postings/page.tsx` | 审核页 |
| `apps/web/src/app/api/admin/postings/**` | 审核 / 下架接口 |
| `apps/web/src/messages/{zh-CN,en}.json` | 文案 |
| `apps/web/src/lib/__tests__/authz.test.ts` | `requireRole` 用例 |

---

## 13. v1 → v2 修正清单（代码实证）

| v1 说法 | 实际 | 处置 |
|---|---|---|
| 新增 `UserRole { CANDIDATE, EMPLOYER }` | `UserRole` 已存在且为 `guest/user/recruiter/admin/enterprise` | 复用 `recruiter`，不改枚举 |
| 门禁读 `session.user.role` | jwt callback 只在登录时写 role，之后不刷新 | 新增 `requireRole()` 查 DB |
| `DiscoveredJob.categories` 是 `String[]` | 是 `Json @default("[]")` | 用 `Json` |
| 分类含 `general` | 只有 `game/finance/tech/ai` | 去掉 `general` |
| auth 在 `apps/web/auth.ts` / `auth.config.ts` | 在 `apps/web/src/lib/auth.ts`，无 `auth.config.ts` | 修正路径 |
| `id String @default(cuid())`，外键 `String` | 全库 uuid + `@db.Uuid`；类型不匹配会迁移失败 | 改 uuid + snake_case + timestamptz |
| 岗位流 `DiscoveredJob ∪ JobPosting` | 岗位流按 `userId` 行级隔离，无公共流 | 改为双源客户端合流 |
| 审核「首期无，待产品决策」 | 平台已有 pending→`/admin/review` 完整审核流 | 直接复用，默认 pending |
| `prisma migrate dev`（或 `db push`） | 仓库有 migrations 历史 | 只用 `migrate dev` |
| 未提测试 / i18n | 仓库有 vitest（含 authz 测试）+ 11 语种 i18n | 纳入阶段 1 / 阶段 4 |

---

## 14. 设计决策记录（why）

- **为什么独立 `JobPosting` 表而非塞进 `DiscoveredJob`**：`DiscoveredJob` 是 watch 聚合管线专用（带 `watchId`/`externalId`/`matchScore`），且按 `userId` 行级隔离；混进全局发布岗会同时污染 ingestion、评分与隔离语义。
- **为什么复用 `recruiter` 而不是新造 `EMPLOYER`**：枚举当初就为此预留，复用即零迁移，且不破坏 admin 后台改角色、authz 测试等既有链路。
- **为什么门禁查 DB**：JWT 里的 role 是登录快照，自助切角色后不重登就不生效——仓库已因这个坑修过管理员入口（见 `(app)/layout.tsx` 注释）。
- **为什么客户端合流而非 SQL union**：两条流的隔离语义不同（私有 vs 公共）、排序键不同（有无 `matchScore`），union 只能得到一个语义混乱且无法正确分页的结果集。
- **为什么 `orgId` 先可空**：首期单人发岗、无组织实体；预留外键位使将来接 `Organization` 只需加表挂键，历史岗不迁移。
- **为什么发布默认进审核**：平台已有审核基建，B 端不接就是绕过审核的垃圾入口；接上的边际成本只有一个列表页。
