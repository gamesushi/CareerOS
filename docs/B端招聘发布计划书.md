# B 端招聘发布模块 · 实施计划书

> 目标：让企业（公司/招聘方）在本网站注册公司主页、发布招聘岗位、并管理候选人投递。
> 本文档为**计划书（Plan）**，仅规划方案，不落地代码。确认后再分阶段实施。

---

## 1. 目标与范围

### 1.1 本期 MVP 范围
- 企业账号：用户以 `enterprise` 角色登录后，可创建/认领一个公司主页。
- 岗位发布：在公司主页下新建、编辑、发布、关闭招聘岗位（JD）。
- 公开展示：发布的岗位在候选端 `/jobs` 中以「企业招聘」专区公开列出，支持按品类/地点/关键词筛选。
- 候选人投递：候选人在岗位详情页投递，附简历（复用现有 Resume）+ 求职信；企业在岗位后台查看/筛选投递。
- 多招聘官（可选，Phase 3）：一个公司可有多个 `recruiter` 成员协作。

### 1.2 暂不做（留扩展位）
- 企业资质/实名审核流程（先留 `verified` 字段，MVP 默认 false，不强制）。
- 发布收费 / 会员门禁（先免费，预留 `plan` 位）。
- 站内消息/邮件通知（先做基础投递落库，通知后续接 BullMQ/Resend）。
- 复杂的 ATS 流水线（Phase 4 起做）。

---

## 2. 现状盘点（基于代码实证）

### 2.1 已具备、可直接复用
| 资产 | 位置 | 说明 |
|---|---|---|
| `UserRole` 枚举含 `enterprise` / `recruiter` / `admin` | `packages/db/prisma/schema.prisma:14` | **设计当初已预留公司端角色**，无需改枚举 |
| `role` 已写入 session（JWT） | `apps/web/src/lib/auth.ts:43` | `session.user.role` 可直接用于门禁 |
| `requireUser()` 返回 `{ userId, role }` | `apps/web/src/lib/api.ts:18` | 缺 `requireRole()` 门禁，需新增 |
| REST 路由风格 `api/v1/...` | `apps/web/src/app/api/v1/` | 新增接口沿用同一风格 + `handler()` 包装 + zod |
| 文件上传 `s3.ts` | `apps/web/src/lib/s3.ts` | 公司 logo / JD 附件复用 |
| `JobMatch` / `CareerProfile` / `Resume` | schema | 候选人匹配、简历可直接用于投递与匹配 |
| i18n 键 `nav.*` + `messages/*.json` | `app-sidebar.tsx:23` | 新增 `nav.employer` 等键 |
| 「批量投递」设计的 `Application` 模型草稿 | 2026-07-27 记忆 | status/resumeId/applyEmail 思路可复用为站内 `JobApplication` |

### 2.2 关键缺口
- **无 Company / JobPost / JobApplication 实体**（schema 完全没有）。
- **无 `requireRole()` 门禁 helper**。
- **无企业端页面、路由、导航入口**。
- **候选人端 `/jobs` 当前只聚合 JobDescription/DiscoveredJob**，需新增「企业招聘」来源。

---

## 3. 数据模型设计（Prisma）

新增 4 个模型 + 2 个枚举，写在 `packages/db/prisma/schema.prisma`，并 `prisma migrate dev`。

```prisma
enum CompanyMemberRole { owner admin recruiter }
enum JobPostStatus     { draft open closed archived }
enum ApplicationStatus { received screening interview offer rejected }

model Company {
  id          String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  slug        String   @unique @db.VarChar(128)        // 公开主页 /c/<slug>
  name        String   @db.VarChar(160)
  logoUrl     String?  @map("logo_url")
  website     String?  @db.VarChar(255)
  description  String?
  industry    String?  @db.VarChar(64)
  size        String?  @db.VarChar(32)                 // startup/smb/mid/large
  location    String?  @db.VarChar(128)
  ownerId     String   @map("owner_id") @db.Uuid
  verified    Boolean  @default(false)
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")
  members     CompanyMember[]
  jobs        JobPost[]
  @@map("companies")
}

model CompanyMember {
  id        String           @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  companyId String           @map("company_id") @db.Uuid
  userId    String           @map("user_id") @db.Uuid
  role      CompanyMemberRole @default(recruiter)
  createdAt DateTime         @default(now()) @map("created_at")
  company   Company          @relation(fields: [companyId], references: [id], onDelete: Cascade)
  user      User             @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@unique([companyId, userId])
  @@map("company_members")
}

model JobPost {
  id              String        @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  companyId       String        @map("company_id") @db.Uuid
  postedById      String        @map("posted_by_id") @db.Uuid
  title           String        @db.VarChar(200)
  description      String                              // 完整 JD（markdown）
  summary         String?                             // 列表摘要
  location        String?       @db.VarChar(128)
  remote          Boolean       @default(false)
  employmentType  String?       @map("employment_type") @db.VarChar(32) // full_time/part_time/contract/intern
  salaryMin       Int?          @map("salary_min")
  salaryMax       Int?          @map("salary_max")
  currency        String?       @db.VarChar(8)
  categories      Json          @default("[]")        // 复用 sources/lib/category 品类，利于候选人匹配
  skills          Json          @default("[]")        // 期望技能标签
  status          JobPostStatus @default(draft)
  externalApplyUrl String?      @map("external_apply_url")
  applicationEmail String?      @map("application_email")
  publishedAt     DateTime?     @map("published_at")
  expiresAt       DateTime?     @map("expires_at")
  createdAt       DateTime      @default(now()) @map("created_at")
  updatedAt       DateTime      @updatedAt @map("updated_at")
  deletedAt       DateTime?     @map("deleted_at") @db.Timestamptz()
  company         Company        @relation(fields: [companyId], references: [id], onDelete: Cascade)
  postedBy        User           @relation(fields: [postedById], references: [id], onDelete: Restrict)
  applications    JobApplication[]
  @@index([companyId, status])
  @@index([status, publishedAt(sort: Desc)])
  @@map("job_posts")
}

model JobApplication {
  id          String           @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  jobPostId   String           @map("job_post_id") @db.Uuid
  candidateId String           @map("candidate_id") @db.Uuid
  resumeId    String?          @map("resume_id") @db.Uuid
  coverLetter String?          @map("cover_letter")
  status      ApplicationStatus @default(received)
  createdAt   DateTime         @default(now()) @map("created_at")
  updatedAt   DateTime         @updatedAt @map("updated_at")
  jobPost     JobPost          @relation(fields: [jobPostId], references: [id], onDelete: Cascade)
  candidate   User             @relation(fields: [candidateId], references: [id], onDelete: Cascade)
  resume      Resume?          @relation(fields: [resumeId], references: [id], onDelete: SetNull)
  @@unique([jobPostId, candidateId])
  @@map("job_applications")
}
```

### 3.1 与现有模型的关系（互补不冲突）
- `JobDescription`：候选侧「导入 JD 用于写简历」——**不是**企业发布。本模块的 `JobPost` 是企业发布侧，二者独立。
- `DiscoveredJob`：来自外部监测（Greenhouse/Lever 等）——独立。
- `JobMatch`：候选简历↔JD 的匹配分数。Phase 4 可让 `JobApplication` 自动跑一次 `JobMatch`（候选简历 ↔ `JobPost.description`）做初筛打分。
- `User`：新增 `companyId?` 不必要——归属通过 `CompanyMember` 多对多表达（支持一人多公司、一公司多人）。

---

## 4. 鉴权与 RBAC

新增 `apps/web/src/lib/api.ts`：
```ts
export async function requireRole(roles: string[]) {
  const { userId, role } = await requireUser();
  if (!roles.includes(role)) throw new ApiError(403, "forbidden", "无权限");
  return { userId, role };
}
```
- 企业端路由/页面统一用 `requireRole(["enterprise","admin"])` 或服务端 `CompanyMember` 校验。
- 页面级：`/employer/*` 布局里 `auth()` 校验 `role ∈ {enterprise, admin}`，否则 redirect。
- 数据级：写操作（改岗/删岗）校验 `CompanyMember(companyId, userId)` 存在且 role ∈ {owner, admin, recruiter}；删除公司仅 owner。
- 候选端公开读 `JobPost` 不受限；写投递需登录候选用户。

---

## 5. 页面 / 路由规划

### 5.1 企业端（新增 `app/(app)/employer/` 分组，复用现有侧边栏布局）
| 路由 | 功能 |
|---|---|
| `/employer` | 企业仪表盘：公司概况、岗位数、收到投递数 |
| `/employer/onboarding` | 首次进入：创建公司（名称/行业/规模/地点/logo）或用邀请码加入 |
| `/employer/company` | 编辑公司资料 |
| `/employer/jobs` | 岗位列表（草稿/发布/关闭 tab） |
| `/employer/jobs/new` | 新建岗位表单 |
| `/employer/jobs/[id]/edit` | 编辑岗位 |
| `/employer/jobs/[id]` | 岗位详情 + 投递管理（列表/状态流转） |
| `/employer/members`（Phase 3） | 团队成员管理 |

### 5.2 候选端（复用现有）
- `/jobs` 新增「企业招聘」专区 tab，聚合 `JobPost(status=open)`，支持品类/地点/关键词筛选（复用现有筛选 UI 与 `categories` 字段）。
- `JobPost` 公开详情页 `/jobs/[id]`（或独立 `/c/<slug>/jobs/[id]`）提供「投递」按钮。
- 投递弹窗：选已有 Resume + 填求职信 → `POST /api/v1/jobs/[id]/applications`。

### 5.3 导航
- `app-sidebar.tsx` 的 `NAV` 增加 `{ href: "/employer", key: "nav.employer", icon: Building2 }`，仅对 `enterprise` 角色显示（读 `session.user.role`）。
- i18n：`messages/*.json` 加 `nav.employer` + `employer.*` 文案（11 语言，沿用现有扁平键名）。

---

## 6. API 路由（REST，沿用 `api/v1/` 风格）

| Method & Path | 门禁 | 说明 |
|---|---|---|
| `POST /api/v1/companies` | user(任何登录用户可创建，置为 enterprise) | 创建公司 + 自动加 owner 成员 + 该用户 role 升 enterprise |
| `GET  /api/v1/companies/me` | enterprise | 返回当前用户所属公司（含成员） |
| `PATCH /api/v1/companies/[id]` | owner/admin | 改公司资料 |
| `POST /api/v1/companies/[id]/members` | owner/admin | 邀请成员（按邮箱），role=recruiter |
| `GET/POST /api/v1/jobs` | 企业端：enterprise+成员；候选端：GET 公开 | 列表/新建岗位 |
| `GET/PATCH/DELETE /api/v1/jobs/[id]` | 成员可改；候选端 GET 公开 | 岗位详情/编辑/关闭 |
| `POST /api/v1/jobs/[id]/applications` | 候选登录用户 | 投递（resumeId + coverLetter） |
| `GET  /api/v1/jobs/[id]/applications` | 该企业成员 | 查看投递 |
| `PATCH /api/v1/jobs/[id]/applications/[aid]` | 该企业成员 | 流转投递状态 |

所有写接口用 `parseBody(schema)` + zod 校验；错误统一走 `handler()`。

---

## 7. AI 能力衔接（Phase 4，可选加分）

- **JD 辅助生成**：企业在 `jobs/new` 填要点（职位/职责/要求要点）→ 调 DeepSeek 生成完整 markdown JD（复用 `apps/worker/src/ai/provider.ts` + `AiRunKind` 已有 `jd_parse`/`resume_generate`）。
- **JD 结构化**：生成后跑一次 `jd_parse` 产出 `categories`/`skills` 标签，写入 `JobPost.categories/skills`，利于候选匹配。
- **投递初筛**：收到投递时，用现有 `JobMatch` 逻辑对 `候选 Resume ↔ JobPost.description` 打分，存 `JobApplication`（或扩展 `JobMatch`）供企业排序。
- **复用约束**：worker 的 `DEEPSEEK_MODEL` 已在 `.env` 显式配置（2026-07-26 修过 v4 命名坑），改完需重启 worker。

---

## 8. 实施阶段（里程碑）

| Phase | 内容 | 产出 | 验证 |
|---|---|---|---|
| **P0 数据模型** | 4 模型 + 2 枚举；`prisma migrate dev`；生成 client | schema + 迁移 | `prisma validate` + 类型生成 |
| **P1 企业与 RBAC** | `requireRole`；`/employer/onboarding` + 公司 CRUD + 成员；导航入口 | 企业可建主页 | 用 dev 邮箱登录→创建公司→角色变 enterprise |
| **P2 岗位 CRUD + 公开** | `JobPost` 增删改查；`/employer/jobs/*`；`/jobs` 企业专区 + 详情 + 筛选 | 企业能发岗、候选能看到 | 发 1 个 open 岗→候选端列表可见 |
| **P3 投递与成员** | `JobApplication` 投递/查看/状态流转；`/employer/members` | 完整闭环 | 候选投递→企业在后台看到并改状态 |
| **P4 AI 辅助**（可选） | JD 生成/结构化/投递打分 | 提效 | 要点→生成 JD→自动打标签 |

每个 Phase 结束跑 `pnpm -r --filter ... run typecheck` + 关键路由烟测（沿用 `apps/worker/scripts` 思路或用 `curl` 探 `api/v1`）。

---

## 9. 风险与开放问题（待确认）

1. **企业实名/防垃圾**：MVP 不审核，仅留 `verified` 字段。是否需要在 P1 加邮箱域名校验或人工审核开关？
2. **发布是否收费**：本期免费；是否要现在就接 Stripe 会员门禁，还是留到后续？
3. **投递存储 vs 外部链接**：岗位可填 `externalApplyUrl`/`applicationEmail` 走站外投递；站内投递落 `JobApplication`。MVP 两者都支持，优先站内。
4. **与「批量投递外部」功能边界**：此前搁置的 `Application`（候选→外部）与本模块 `JobApplication`（候选→站内企业岗）方向相反，是否合并为一张表加 `kind` 字段？建议 MVP 分开，避免耦合。
5. **公开岗位 SEO / 分页 / 搜索**：P2 先做基础列表+筛选；全文检索（pg_trgm 扩展已启用）可后续加。
6. **一人多公司 / 一公司多人**：通过 `CompanyMember` 已支持，P1 先实现单人创建，P3 补多成员。

---

## 10. 结论

B 端招聘发布模块可在**不改动现有候选侧架构**的前提下增量接入：数据层加 4 个模型、鉴权层加 `requireRole`、页面层加 `/employer/*` 并复用现有侧边栏与 `/jobs` 展示、接口层沿用 `api/v1` REST 风格。角色枚举已预留，复用度高，风险可控。建议从 **P0→P1→P2** 先打通「企业建主页 + 发岗 + 候选可见」最小闭环，再视情况做 P3 投递与 P4 AI。
