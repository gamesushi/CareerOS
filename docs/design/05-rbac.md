# CareerOS 权限系统（RBAC）

## 1. 原则

- 角色存 `users.role`，MVP 只发放 `user` 与 `admin`；`guest` 是未登录态，`recruiter`/`enterprise` 表结构与矩阵先定义、入口不开（ADR-006）。
- **两层判定**：① 角色能不能碰这类资源（RBAC 矩阵）；② 这一行让不让你看（行级规则：owner-only，或对 recruiter 按 `users.privacy` 开关过滤）。
- 实现：Next.js middleware 做登录态与角色 gate；数据层每个查询强制注入 `user_id` 条件（Prisma extension 统一实现，杜绝漏写）；未来接 Supabase/RLS 可平移。

## 2. 权限矩阵

图例：✅ 允许 · 🔒 仅本人行 · 🔎 仅隐私开关放行的行 · ❌ 拒绝 · 🚧 MVP 不实现

| 资源 / 操作 | Guest | User | Recruiter 🚧 | Enterprise 🚧 | Admin |
|---|---|---|---|---|---|
| 注册/登录 | ✅ | — | — | — | — |
| 公开职业主页（profile_public=true） | ✅只读 | ✅只读 | ✅只读 | ✅只读 | ✅ |
| 职业实体 CRUD（经历/项目/技能/成果/教育） | ❌ | 🔒 | ❌ | ❌ | ✅ |
| 工作日志 CRUD | ❌ | 🔒 | ❌ | ❌ | ✅（仅审计场景） |
| 简历导入/生成/导出 | ❌ | 🔒 | ❌ | ❌ | 🔒 |
| JD 上传与匹配（求职者视角） | ❌ | 🔒 | — | — | ✅ |
| 人才搜索（resume_searchable=true 的用户） | ❌ | ❌ | 🔎 | 🔎 | ✅ |
| 联系候选人（recruiter_contact=true） | ❌ | ❌ | 🔎 | 🔎 | ❌ |
| 发布职位（企业侧） | ❌ | ❌ | ✅本组织 | ✅本组织 | ✅ |
| 组织成员/席位管理 | ❌ | ❌ | ❌ | ✅本组织 | ✅ |
| Connection（follow/friend） | ❌ | ✅ 🚧 | ✅ 🚧 | ❌ | ✅ |
| 用户管理/角色发放 | ❌ | ❌ | ❌ | ❌ | ✅ |
| ai_runs 审计/成本面板 | ❌ | 🔒（自己的用量） | ❌ | ✅本组织 | ✅ |
| 系统配置（模型路由/打分权重） | ❌ | ❌ | ❌ | ❌ | ✅ |

## 3. 隐私开关与角色的关系

`users.privacy` 四开关是**用户侧的最终否决权**，优先级高于任何角色能力：

| 开关 | 默认 | 放行对象 |
|---|---|---|
| profile_public | false | Guest+ 可见职业主页（脱敏：不含联系方式/日志） |
| resume_searchable | false | Recruiter 人才搜索命中 |
| recruiter_contact | false | Recruiter 站内触达 |
| feed_visible | false | Phase 7 动态流可见性 |

Recruiter 搜索的实现即：向量/条件检索时 SQL 级 `JOIN users ON privacy->>'resume_searchable'='true'`，而不是查完再过滤。

## 4. MVP 落地清单

- [ ] `role` 枚举 + Auth.js session 注入 role
- [ ] middleware：`/settings/admin/*` 仅 admin；其余业务路由仅登录用户
- [ ] Prisma client extension：所有业务模型自动 `where user_id = session.user.id`（admin bypass 显式声明）
- [ ] 隐私 Settings 页四开关（后两个置灰）
- [ ] 审计：admin 对他人数据的每次读取写 audit log（复用 ai_runs 风格另建 audit_logs，Phase 5 前可缓）
