# CareerOS B 端 Phase 3 · 站内投递

> 版本：v1 · 2026-08-02 · 状态：**已实施并全链路验证通过**（验收清单见 §9，全部勾选）
> 前置：Phase 1 [`b-end-plan.md`](./b-end-plan.md)（posting-only）、Phase 2 [`B端招聘发布计划书.md`](./B端招聘发布计划书.md)（组织实体）均已交付。

---

## 1. 本期目标

前两期的岗位只有**外链投递**（`JobPosting.url`）——雇主发完岗，候选人点出去就断了，
雇主在 CareerOS 上看不到任何回流。Phase 3 把这一环闭上：

- 候选人在站内选一份已有简历 + 写求职信，直接投递。
- 雇主在岗位下看到投递列表、**读得到候选人的简历**、流转状态。
- 简历不是公开的：只有「候选人主动投给你的那一份」，你才看得到。

### ❌ 本期不做
- 邮件/站内信通知（落库即可，通知接 BullMQ + SMTP 是独立工程）
- 简历初筛打分（`JobMatch` 复用见 §8，属于加分项不是闭环必需）
- 雇主批量操作 / 导出候选人
- 候选人撤回后再投（撤回是终态，避免刷屏）

---

## 2. 与既有 `Application` 的边界（**最容易搞错的地方**）

仓库里**已经有一张 `applications` 表**，但它是**候选人自己的看板**：

| | 既有 `Application` | 新增 `JobApplication` |
|---|---|---|
| 归属 | 候选人 (`userId`) | 岗位 (`jobPostingId`) |
| 谁写 | 候选人自己记录 | 候选人投递、雇主流转 |
| 对象 | 任意外部岗（`DiscoveredJob`/手填） | 只能是站内 `JobPosting` |
| 状态语义 | `considering`（想投）… 候选人视角 | `submitted`… 雇主视角 |
| 谁能看 | 只有本人 | 本人 + 该岗位的雇主 |

**结论：分两张表，不合并。** 语义、归属方、可见范围三者全不同，硬塞一个 `kind`
字段会让每个查询都要带条件，还会把候选人的私密看板暴露到雇主侧的查询路径上。

状态枚举同理另起 `JobApplicationStatus`，不复用 `ApplicationStage`——后者的
`considering`（想投）在雇主视角下没有意义。

> 顺带：候选人投递成功后，**可以**在自己的看板里自动落一条 `Application`（stage=applied）
> 做统一追踪。本期先不做，避免两张表的写入互相耦合；留作 Phase 4 的小优化。

---

## 3. 数据模型

```prisma
enum JobApplicationStatus {
  submitted  // 已投递（候选人刚投）
  screening  // 筛选中
  interview  // 面试中
  offer      // 已发 offer
  rejected   // 不合适
  withdrawn  // 候选人撤回（终态）

  @@map("job_application_status")
}

model JobApplication {
  id           String               @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  jobPostingId String               @map("job_posting_id") @db.Uuid
  candidateId  String               @map("candidate_id") @db.Uuid
  resumeId     String?              @map("resume_id") @db.Uuid   // 投递时选的简历
  coverLetter  String?              @map("cover_letter")
  status       JobApplicationStatus @default(submitted)
  employerNote String?              @map("employer_note") @db.VarChar(1000) // 雇主备注，候选人不可见
  statusAt     DateTime?            @map("status_at") @db.Timestamptz()     // 最近一次状态变更
  createdAt    DateTime             @default(now()) @map("created_at") @db.Timestamptz()
  updatedAt    DateTime             @default(now()) @updatedAt @map("updated_at") @db.Timestamptz()

  jobPosting JobPosting @relation(fields: [jobPostingId], references: [id], onDelete: Cascade)
  candidate  User       @relation("CandidateApplications", fields: [candidateId], references: [id], onDelete: Cascade)
  resume     Resume?    @relation(fields: [resumeId], references: [id], onDelete: SetNull)

  @@unique([jobPostingId, candidateId])          // 一个岗位每人只能投一次
  @@index([jobPostingId, status, createdAt(sort: Desc)])
  @@index([candidateId, createdAt(sort: Desc)])
  @@map("job_applications")
}
```

**说明**
- `@@unique([jobPostingId, candidateId])`：防重复投递。重复投返回 409 而不是静默建第二条。
- `resumeId` 用 `SetNull`：候选人事后删简历，投递记录还在（雇主看到「简历已被候选人删除」），
  比连带删掉整条投递合理。
- `employerNote` 明确标注候选人不可见——接口层必须保证不回传给候选人。

---

## 4. 隐私边界（本期最需要想清楚的一条）

投递意味着候选人**主动**把一份简历交给这个雇主。据此划线：

| 数据 | 雇主可见 | 依据 |
|---|---|---|
| 候选人姓名、邮箱 | ✅ | 主动投递即意味着愿意被联系；否则雇主无法回复 |
| 投递时选的那份简历 | ✅ | 候选人自己选的，投递即授权 |
| 求职信 | ✅ | 同上 |
| 候选人的**其他**简历 | ❌ | 未授权 |
| 候选人的职业知识库 / 工作日志 / 岗位追踪 | ❌ | 与投递无关 |
| 撤回后的简历访问 | ❌ | 撤回即收回授权 |

授权判定写在一处：`requireEmployerOnApplication(applicationId, userId)`（`lib/job-applications.ts`）——
是该岗位的发布者本人，**或**该岗位所属组织的成员。简历访问路由必须走它，
不能只靠「知道 resumeId」就放行（否则等于把简历 id 变成了访问令牌）。
按岗位维度的列表接口走同源的 `requireEmployerOnPosting()`。

---

## 5. 状态机

```
submitted ──> screening ──> interview ──> offer
    │             │             │
    └─────────────┴─────────────┴──> rejected      （雇主侧，任意非终态皆可拒）

submitted/screening/interview ──> withdrawn        （候选人侧，撤回后不可再投）
```

- 雇主只能改成 `screening | interview | offer | rejected`，**不能**改成 `withdrawn`（那是候选人的动作）。
- 候选人只能改成 `withdrawn`，且只能从非终态改。
- `offer`/`rejected`/`withdrawn` 为终态，不再流转。

---

## 6. 接口

| Method & Path | 门禁 | 说明 |
|---|---|---|
| `POST /api/v1/job-postings/[id]/applications` | 登录候选人 | 投递（resumeId + coverLetter）。岗位须 open+approved+未下架；重复投 409；不能投自己发的岗 |
| `GET /api/v1/job-postings/[id]/applications` | 该岗位雇主 | 投递列表（含候选人姓名邮箱、简历标题、求职信、状态） |
| `PATCH /api/v1/job-applications/[id]` | 雇主 or 候选人 | 雇主流转状态 / 写备注；候选人撤回。按角色分支校验目标状态 |
| `GET /api/v1/job-applications/[id]/resume` | 该岗位雇主 | 渲染候选人投递的那份简历 PDF（inline） |
| `GET /api/v1/job-applications/mine` | 登录候选人 | 我投过的岗与当前状态（候选端展示徽标用） |

简历 PDF 渲染与 `resumes/[id]/export` 是同一套逻辑，抽 `lib/pdf/render.ts` 复用，
避免两份 40 行的 merge+render 代码各自漂移。

---

## 7. 页面

| 位置 | 改动 |
|---|---|
| `/jobs/active` | 站内发布岗增加「投递」按钮 → 弹窗选简历 + 写求职信；已投递的显示状态徽标，按钮变「已投递」 |
| `/employer/jobs` | 每条发布显示投递数，点进收件箱 |
| `/employer/jobs/[id]/applications` | 收件箱：候选人、简历（点开 PDF）、求职信、状态流转按钮、雇主备注 |

---

## 8. 实施阶段

1. **Schema**：枚举 + 表 + `JobPosting.applications` / `User.jobApplications` / `Resume.jobApplications` 反向关系；`migrate dev`。
2. **API**：契约 + 授权 helper + 五个接口 + PDF 渲染抽取。
3. **候选端**：投递弹窗 + 状态徽标。
4. **雇主端**：投递数 + 收件箱 + 流转。
5. **收尾**：i18n、DB 集成测试、全链路浏览器验证。

---

## 9. 验收标准

- [x] 候选人可对已过审在招岗投递，选简历 + 写求职信
- [x] 重复投同一岗 → 409 `already_applied`，不产生第二条
- [x] 不能投自己发布的岗 → 400 `self_apply`
- [x] 未过审 / 草稿 / 已下架的岗不可投 → 409 `not_open`
- [x] 雇主能在收件箱看到投递，并打开候选人投的那份简历 PDF（实测返回 16.8KB application/pdf）
- [x] 非该岗位雇主访问投递或简历 → 403（即使知道 id）；同组织成员可以，个人名义岗则只有发布者本人可以
- [x] 候选人撤回后，雇主再访问该简历 → 403「候选人已撤回投递，简历不再可见」
- [x] 雇主改不成 `withdrawn`（400 `invalid_status`），候选人改不成 `offer`（403）
- [x] 终态不可再流转 → 409 `terminal`
- [x] `employerNote` 不出现在候选人侧任何响应里；候选人写它 → 403

**测试**：`pnpm test:db` 36 passed（新增 15 条 `job-applications.db.test.ts`，重点是隐私边界）；
`pnpm test` 67 passed；`pnpm -r typecheck` 全过。

---

## 10. 风险与待办

- **无通知**：投递后雇主不会收到提醒，得自己进后台看。有量之后必须接邮件。
- **简历 PDF 渲染开销**：每次查看都实时渲染（与既有导出一致）。雇主批量看会慢，可加缓存。
- **骚扰投递**：目前不限频。同一候选人可以对每个岗各投一次，岗位多了仍可能刷屏——
  需要时加「每人每天最多投 N 个岗」。
- **候选人看不到自己投递的详情页**：本期只在岗位卡片上给状态徽标，没有独立的「我的投递」页面。
