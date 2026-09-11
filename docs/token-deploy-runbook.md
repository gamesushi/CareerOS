# Token 用量限制系统 · 部署 Runbook

> 配套设计文档：`docs/token-system-plan.md`
> 锁定参数（用户已拍板）：免费额度 C 30,000 / B 100,000（一次性不刷新）；每日上限 C 8,000 / B 25,000（UTC 0 点重置）；1 内部 token = 1 AI token（tokensIn+tokensOut）。

## 一、本次改动文件清单

**Schema / 迁移 / Seed（packages/db）**
- `prisma/schema.prisma`：新增 `TokenBalance` / `TokenTransaction` / `TokenPrice`；`AiRun` 加 `costTokens` / `costUsd`；`User` 加 `tokenBalance` 反向关系；`enum TokenTxKind { consume, grant, deduct }`。
- `prisma/migrations/20260911000000_token_system/migration.sql`：建 3 张表 + `ai_runs.cost_tokens`/`cost_usd` 列 + enum。
- `prisma/seed.ts`：`seedTokenPrices()`（2026-09 真实单价）+ `backfillTokenBalances()`（按角色给现有账号 30k/100k）。

**计费库（web / worker 两份逻辑一致）**
- `apps/web/src/lib/tokens.ts`、`apps/worker/src/billing/tokens.ts`
  - 分档 C/B、余额惰性创建（按角色发免费额度）、每日上限、原子扣费、`grantTokens`、管理 `getTokenStatus`、`costForModel`。

**计量接入（预检 + 扣费）**
- `apps/worker/src/ai/audit.ts`：`startRun` 预检 `assertAiQuota`，`finishRun` 扣 `tokensIn+tokensOut` 并写 `costUsd`。
- `apps/web/src/lib/ai-log.ts`：`startAiRun` 预检，`finishAiRun` 扣费。
- 补接 3 个漏网 web 路由：`profile/translate`、`resumes/translate-section`、`discovered-jobs/import-url`（含 workday 分支 `userId` 透传 + worker `fetchWorkdayJob.ts` 接入计量）。

**API**
- `GET /api/v1/tokens`（余额 / 档位 / 价格 / 流水）
- `GET /api/v1/tokens/prices`（价格表）
- `POST /api/admin/tokens/adjust`（grant / deduct，requireAdmin 门禁）

**UI**
- 设置页 Token 卡片：`apps/web/src/app/(app)/settings/token-card.tsx` + 设置页接入。
- 管理台：`apps/web/src/app/admin/tokens/page.tsx` + `token-adjust-button.tsx` + 侧边栏入口（全局成本看板 + 用户额度表 + 调节）。
- 全局 402 toast：前端 `lib/client.ts` 的 `api()` 已统一拦截非 2xx → AI 触发处额度不足自动弹「token 余额不足 / 今日用量已达上限」。

## 二、本地联调
```bash
pnpm install                      # 若依赖未装
pnpm -F db generate              # 生成 Prisma Client
pnpm -F db migrate:dev           # 本地库建表（或 prisma db push）
pnpm -F db seed                  # 写真实单价 + 回填现有账号
pnpm -F web dev & pnpm -F worker dev
```
- 本地 provider 无 key → 走 mock，扣费恒 0，验证流程不烧额度。
- 清掉 `HTTP_PROXY`（否则 SSR/RSC 被代理拦截）。

## 三、远程（ucareeros.com / OCI VM beihang@100.88.161.94）
VM 网络可达但需密码登录（SSH 口令 **8914**）。以下步骤需在能登录 VM 的环境执行（或提供密码用 sshpass 跑）：
```bash
cd <repo> && git pull           # 拉取本次改动（合并后分支）
pnpm -F db generate
pnpm -F db migrate:deploy       # 建表 + 补 ai_runs.cost_usd（幂等，低危）
pnpm -F db seed                 # 写价格 + 按角色回填现有账号（也 upsert 一个本地 dev 用户，无害）
# 也可不跑 seed：用户首次访问 /settings 或首次 AI 调用会自动惰性获额度
docker compose -f docker-compose.prod.yml up -d --build web worker
```
验证：
1. 登录 → `/settings` 见「AI 用量额度」卡片。
2. 跑一次 AI（简历解析）→ 余额下降、流水新增 `consume`。
3. admin → `/admin/tokens` 看成本看板 + 用户额度，可 grant/deduct。
4. 限额：把某用户余额/每日调小，触发 AI 应返回 **402** + toast。

## 四、成本复核
- deepseek-chat ¥2/¥3 per 1M token；gpt-4.1-mini ¥2.9/¥11.5；embedding ¥0.14。
- 单用户用光 30k ≈ ¥0.07；1000 用户月成本 <¥200。限制本质是防滥用 + 促活，不是省钱。

## 五、风险与决策点
- 远程是生产 Postgres，`migrate:deploy` 会 ALTER `ai_runs` 加列、建 3 张表——低危但属生产变更，建议低峰执行并先 `pg_dump` 备份。
- 每日上限基于真实累计（`used >= cap` 才拦），单次大调用可能让当天微超 cap，但下次立刻拦截；成本可忽略。
- 余额预检用中值估计，若某次真实用量远超中值，扣费兜底（余额不足时不扣、调用照常，平台微亏），不会让余额变负。
