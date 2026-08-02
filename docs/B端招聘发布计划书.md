# CareerOS B 端 Phase 2 · 组织实体与公司主页

> 版本：v2 · 2026-08-02 · 状态：**阶段 1-4 已实施并验证通过**（验收清单见 §8，全部勾选）
> 前置：[`b-end-plan.md`](./b-end-plan.md)（Phase 1 posting-only）**已交付**——`JobPosting` 单表、`recruiter` 角色、
> `requireRole()` DB 权威门禁、`/employer/jobs` 发岗、`/jobs/active` 双源合流、`/admin/postings` 审核。
>
> **v2 修订说明**：v1（2026-07-27 的 239 行版本）写于 Phase 1 落地之前，其中三处已被现实推翻：
> ① 设计的 `Company`+`JobPost`+`JobApplication` 四件套里，`JobPost` 已以 `JobPosting` 单表形态落地，不再新建；
> ② §5.2 的「候选端 `/jobs` 聚合 JobPost」不成立——`/jobs` 是 JD 匹配页，且岗位流按 userId 行级隔离；
> ③ `requireRole()` 已实现，不再是缺口。v2 据此收敛范围，只做**组织实体**这一层。

---

## 1. 本期目标

Phase 1 的岗位是「挂在个人名下」的：`JobPosting.postedByUserId` 是唯一归属，`company` 只是一个**自由填写的字符串**。
同一家公司发两个岗，两条记录之间没有任何关联，候选人也点不进「这家公司还在招什么」。

Phase 2 补上这一层：

- **组织实体**：`Organization` + `OrganizationMember`，一人可属多组织、一组织可有多人（表结构支持，UI 首期只做单 owner）。
- **岗位归属**：`JobPosting.orgId`（Phase 1 已预留可空列）补上真实外键；以组织名义发布的岗，`company` 由组织名派生而非手填。
- **公开公司主页** `/c/<slug>`：免登录可访问，展示组织资料 + 该组织全部已过审在招岗位。

### ❌ 本期不做
- 站内投递（`JobApplication`）→ Phase 3
- 多成员邀请 / 权限矩阵 UI → Phase 3（表已建好，只用 owner）
- 企业实名认证（留 `verified` 字段，默认 false，不强制）
- ~~Logo 上传~~ → **2026-08-02 已补做**：`POST /api/v1/organizations/[id]/logo`（PNG/JPG/WebP ≤2MB，**不收 SVG**——它会以 `<img>` 出现在免登录公开页上，SVG 可内嵌脚本）+ 免登录读取 `/api/public/org-logo/[id]`
- 发布收费 / 会员门禁

---

## 2. 现状盘点（Phase 1 交付后，2026-08-02 实证）

| 资产 | 位置 | 本期怎么用 |
|---|---|---|
| `JobPosting.orgId String? @db.Uuid` | `schema.prisma` | **已预留**，本期补 `@relation` 外键，历史岗不迁移 |
| `OrgType`（individual_hr/startup/non_company_team/enterprise） | `schema.prisma` | 保留。个人 HR 可以不建组织继续发岗 |
| `requireRole(EMPLOYER_ROLES)` | `lib/api.ts` | 组织写接口直接复用 |
| `JobReviewStatus` + `/admin/postings` 审核流 | `lib/admin/jobs.ts` | 组织岗一样进审核，无需改动 |
| `PUBLIC_POSTING_WHERE` 三道闸门 | `lib/job-postings.ts` | 公司主页的岗位列表直接复用同一闸门 |
| 免登录公开页范式 | `app/tools/leaderboard/`（server component 直查 DB，无需 API） | `/c/<slug>` 照抄 |
| `middleware.ts` 的 `PUBLIC_PATHS` | `apps/web/src/middleware.ts:7` | **必须加 `/c`**，否则公司主页会被登录 gate 拦截 |
| `lib/s3.ts` `putObject/deleteObject` | 已接 MinIO | 留给后续 logo 上传 |

### 关键缺口
- 无组织实体，`JobPosting.company` 是孤立字符串。
- 无 slug 生成/查重逻辑（全库首次出现用户可见的 slug）。
- 无「按组织查岗位」的查询封装。

---

## 3. 数据模型

命名对齐 Phase 1 已落地的 `orgId` / `orgType`，用 **`Organization`** 而非 v1 的 `Company`
（否则会出现 `orgId` 指向 `companies` 表这种拧巴的对应关系）。

```prisma
enum OrgMemberRole {
  owner      // 建组织的人，唯一能删组织
  admin      // 可改资料、可管成员
  recruiter  // 只能发岗/管自己的岗

  @@map("org_member_role")
}

model Organization {
  id          String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  slug        String   @unique @db.VarChar(64)   // 公开主页 /c/<slug>，小写字母数字连字符
  name        String   @db.VarChar(160)
  orgType     OrgType  @map("org_type")          // 与 JobPosting.orgType 同一词表
  logoUrl     String?  @map("logo_url")
  website     String?  @db.VarChar(255)
  description String?                            // 公司介绍（公开主页展示）
  industry    String?  @db.VarChar(64)
  size        String?  @db.VarChar(32)           // 1-10 / 11-50 / 51-200 / 200+
  location    String?  @db.VarChar(128)
  verified    Boolean  @default(false)           // 预留：企业实名，首期不强制
  createdAt   DateTime @default(now()) @map("created_at") @db.Timestamptz()
  updatedAt   DateTime @default(now()) @updatedAt @map("updated_at") @db.Timestamptz()

  members  OrganizationMember[]
  postings JobPosting[]

  @@map("organizations")
}

model OrganizationMember {
  id     String        @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  orgId  String        @map("org_id") @db.Uuid
  userId String        @map("user_id") @db.Uuid
  role   OrgMemberRole @default(recruiter)
  createdAt DateTime   @default(now()) @map("created_at") @db.Timestamptz()

  org  Organization @relation(fields: [orgId], references: [id], onDelete: Cascade)
  user User         @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([orgId, userId])
  @@index([userId])
  @@map("organization_members")
}
```

`JobPosting` 侧只加关系，**不动已有列**：

```prisma
  org Organization? @relation(fields: [orgId], references: [id], onDelete: SetNull)
  @@index([orgId, status, reviewStatus])   // 公司主页岗位列表
```

`User` 侧加 `orgMemberships OrganizationMember[]`。

**说明**
- `orgId` 保持可空：个人 HR 不建组织也能发岗（Phase 1 的行为不能被破坏）。
- `onDelete: SetNull`：删组织不连带删岗位，历史岗退化为「个人发布」而不是凭空消失。
- slug 全库唯一，长度 ≤64，`^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$`；由组织名生成候选值 + 冲突加后缀。
  中文名生成不出 ascii slug 时回落到 `org-<8位随机>`，让用户可改。

---

## 4. 权限模型

三层，与仓库既有分层一致：

1. **角色层**：`requireRole(EMPLOYER_ROLES)`——不是招聘者根本进不来（已有）。
2. **成员层**：写组织 / 以组织名义发岗，必须是该组织成员。新增 `requireOrgMember(orgId, userId, roles?)`。
3. **归属层**：改岗仍旧校验 `postedByUserId`（已有，不变）。

- 建组织：任何 `recruiter` 可建，建者自动成为 `owner` 成员（同一事务）。
- 改资料：`owner` / `admin`。
- 删组织：仅 `owner`（本期不提供 UI，留 API 层判断）。
- 以组织名义发岗：任意成员。

---

## 5. 接口

| Method & Path | 门禁 | 说明 |
|---|---|---|
| `POST /api/v1/organizations` | `requireRole(EMPLOYER)` | 建组织 + 自动写 owner 成员（事务），slug 冲突自动加后缀 |
| `GET /api/v1/organizations` | `requireRole(EMPLOYER)` | 我所属的组织列表（含我的成员角色） |
| `PATCH /api/v1/organizations/[id]` | 成员 owner/admin | 改资料（slug 可改，仍校验唯一） |

公司主页 `/c/<slug>` **不加 API**——照 `tools/leaderboard` 的范式，server component 直接查库。

发岗接口 `POST /api/v1/job-postings` 增加可选 `orgId`：传了就校验成员身份，并用组织的 `name`/`orgType` 覆盖 `company`/`orgType`（避免同一组织不同岗写出不同公司名）。

---

## 6. 页面

| 路由 | 门禁 | 内容 |
|---|---|---|
| `/employer/company` | recruiter | 无组织时显示创建表单；有则显示编辑表单 + 公开主页链接 |
| `/employer/jobs` | recruiter | 发岗表单加「以谁的名义发布」：个人 / 我的某个组织。选组织时 `company` 字段自动锁定为组织名 |
| `/c/[slug]` | **公开** | 组织资料 + 已过审在招岗位列表；空态提示「暂无在招岗位」 |

候选端 `/jobs/active` 的 posted 岗：有组织的把公司名渲染成指向 `/c/<slug>` 的链接。

---

## 7. 实施阶段

### 阶段 1 — Schema + 契约
`OrgMemberRole` 枚举 + 两张表 + `JobPosting.org` 关系 + `User.orgMemberships`；`migrate dev`。
shared 加 `organizationInput` / `slugify()`。
**验收**：`organizations` / `organization_members` 建表；`prisma validate` 过；typecheck 过。

### 阶段 2 — API + 成员门禁
`requireOrgMember()`；三个组织接口；发岗接口支持 `orgId`。
**验收**：非成员传别人的 `orgId` 发岗 → 403；建组织后自己是 owner。

### 阶段 3 — 页面
`/employer/company`、发岗表单名义选择、`/c/[slug]`、middleware 放行 `/c`、候选端公司名链接。
**验收**：建组织 → 以组织名义发岗 → 过审 → 未登录浏览器能打开 `/c/<slug>` 看到该岗。

### 阶段 4 — 收尾
i18n（zh-CN + en）、DB 集成测试（slug 唯一 / 成员门禁 / 主页可见性闸门）、全链路浏览器验证。

---

## 8. 验收标准

- [x] `recruiter` 可建组织，建者自动是 `owner`
- [x] 同名组织生成的 slug 自动去重，不会 500；纯中文名回落为 `org-<随机>`（实测「星海互娱」→ `org-lpbqbbj4`，用户可改写为 `xinghai-games`）
- [x] 以组织名义发的岗 `company` 等于组织名——实测故意传 `company: "我乱填的公司名"` + `orgType: individual_hr`，落库为「星海互娱」/`startup`
- [x] 非成员传该组织 `orgId` 发岗 → 403 `not_org_member`
- [x] `/c/<slug>` **未登录**可访问（无 cookie 请求返回 200 且不重定向），只出该组织已过审、在招、未下架的岗
- [x] 未过审 / 已下架 / 草稿岗 / 个人名义岗都不出现在公司主页
- [x] 个人身份（不选组织）发岗仍然可用，Phase 1 行为不回退
- [x] 删组织后其历史岗仍在（`orgId` 置空、冗余的 `company` 保留）

**测试**：`pnpm test:db` 21 passed（新增 9 条 `organizations.db.test.ts`）；`pnpm test` 67 passed；`pnpm -r typecheck` 全过。

---

## 9. 风险与待办

- **slug 抢注**：首期无审核，可能被抢注知名公司名。缓解：`verified` 字段已留位；真出现纠纷靠管理员改 slug。
- **组织名冒用**：与上同源，属于 Phase 1 就存在的问题（`company` 本来就是自由填写），审核流是唯一防线。
- **公开页 SEO / 缓存**：`/c/<slug>` 目前 `force-dynamic`，有量之后应改 ISR。
- ~~**Logo 上传**~~：已完成（见 §1）。仍未做的是尺寸裁剪与图片压缩——现在原图直传，2MB 的 logo 会原样发给每个访客。

---

## 10. Phase 3 展望（不在本期）

站内投递闭环：`JobApplication`（jobPostId + candidateId + resumeId + coverLetter + status），
候选人在岗位详情页选简历投递，雇主在 `/employer/jobs/[id]/applications` 看投递并流转状态；
可复用既有 `JobMatch` 对「候选简历 ↔ 岗位描述」打分做初筛排序。
与候选侧既有的 `Application`（追踪自己投的外部岗）方向相反，**建议分表不合并**。
