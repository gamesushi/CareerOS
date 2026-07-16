# CareerOS 设计文档集

职业操作系统：职业知识库 + AI 简历生成 + JD 匹配。基于 WeKnora（集成而非改造，见 ADR-001）。

| 文档 | 内容 |
|---|---|
| [00-architecture-decisions.md](00-architecture-decisions.md) | 8 条 ADR：WeKnora 角色、技术栈、向量方案、简历渲染、MVP 边界（⚠️ 标记项与原计划书有出入） |
| [01-database-schema.md](01-database-schema.md) | ER 图 + 完整 DDL（PostgreSQL + pgvector，18 表）+ 技能证据/匹配打分公式 |
| [02-api-design.md](02-api-design.md) | REST 端点总览 + OpenAPI 3.1 Schema + WeKnora 服务间调用清单 |
| [03-pages-prd.md](03-pages-prd.md) | 10 个页面的目标/组件树/交互/数据来源 + 核心用户流程图 |
| [04-ai-workflows.md](04-ai-workflows.md) | AI Gateway 模块设计 + 导入/匹配/生成三条管线流程图 + 防幻觉与成本护栏 |
| [05-rbac.md](05-rbac.md) | 五角色权限矩阵（MVP 实现 User/Admin）+ 隐私开关行级规则 |
| [06-mvp-roadmap.md](06-mvp-roadmap.md) | 4 个 Sprint 的可勾选任务列表 + 验收标准 + 风险清单 |

阅读顺序：先 00（有待拍板项），再按需。
