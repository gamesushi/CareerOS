# CareerOS

职业操作系统：职业知识库 + AI 简历生成 + JD 匹配。简历只是职业数据库的视图。

设计文档见 [docs/design/](docs/design/README.md)（ADR / 数据库 / API / PRD / AI 工作流 / RBAC / 路线图）。

## 结构

```
apps/web          Next.js 16 全栈（UI + API Route Handlers）
apps/worker       BullMQ worker（AI 异步任务，Sprint 2 起填充）
packages/db       Prisma schema + client（PostgreSQL + pgvector）
packages/shared   zod 实体契约 + 归一化规则（前后端单一来源）
```

## 本地开发

```bash
docker compose up -d            # postgres(pgvector):5433 redis:6380 minio:9100
cp .env.example .env            # 已含本地默认值
pnpm install
pnpm db:migrate                 # prisma migrate dev
pnpm --filter @careeros/db db:indexes   # trgm/HNSW 等 raw 索引
pnpm dev                        # web -> http://localhost:3000
pnpm dev:worker                 # 可选，Sprint 1 阶段无任务
```

开发模式登录：任意邮箱直登（`AUTH_DEV_CREDENTIALS=true`）。

WeKnora（文档解析/证据检索引擎，Sprint 2 接入）在 `../WeKnora` 用官方 compose 独立启动，
CareerOS 只通过其 REST API 调用，不 fork、不共库。
