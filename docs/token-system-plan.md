# CareerOS Token 系统开发计划书

> 目标：为 CareerOS 引入内部 token 额度系统。用户可查询余额、管理员可调节额度、所有 AI 相关操作按实际用量扣费、可查询各模型 token 价格；余额耗尽需充值（本期充值网关未做，测试期由管理员发放额度模拟）。
> 状态：计划书（待确认后进入实现）
> 编写日期：2026-08-01

---

## 1. 目标与范围

### 1.1 本期必须交付
1. **查询余额**：用户可在设置页看到当前 token 余额、免费额度、下次刷新时间、最近流水。
2. **调节额度**：管理员可将任意用户额度上调（发放/赠送，模拟充值）或下调（校正/扣减）；用户无自助重置权限。用户余额耗尽后需充值（本期充值网关未做，测试期由管理员发放额度模拟）。
3. **AI 操作扣费**：所有走 AI 的功能（简历解析/生成、JD 解析、职业画像、工作日志摘要、岗位匹配打分、文书/谈判信生成、翻译、防诈检测等）按实际 token 用量扣减余额。
4. **查询价格**：提供各 AI 模型的 token 单价（¥/1K 输入、¥/1K 输出），用户可透明查看成本。

### 1.2 本期不做（后续可扩展）
- 真实支付/充值网关（微信支付、Stripe 等）。本期 token 为**平台内部额度**，由系统赠送或管理员发放。
- 多币种结算、发票、订阅套餐。

---

## 2. 现状梳理（为什么现在做成本很低）

调研发现现有代码已具备 80% 的计量基础设施，只需"接上扣费与余额"：

| 已有能力 | 位置 | 说明 |
|---|---|---|
| `AiRun` 审计表 | `packages/db/prisma/schema.prisma:741` | 已含 `tokensIn`/`tokensOut`/`model`/`costUsd`（字段已留，未用） |
| Worker 记账 | `apps/worker/src/ai/audit.ts` | `startRun()`/`finishRun()` 在每次 LLM 调用前后落库 |
| Web 记账 | `apps/web/src/lib/ai-log.ts` | `startAiRun()`/`finishAiRun()`/`aiRateLimited()` 同理 |
| token 用量 | `apps/worker/src/ai/provider.ts:96` | `chat()` 已返回 `tokensIn`/`tokensOut`（来自 API `usage`） |
| 限流 | 同上 | `aiRateLimited()` 已按 kind+窗口限流，可复用 |

### 2.1 AI 消费面清单（全部需计量）
**Worker 侧（BullMQ 任务，均经 `chat()`）：**
- `resumeParse`（简历结构化抽取）
- `resumeGenerate`（简历生成）
- `resumeDerive`（简历派生）
- `profileGenerate`（职业画像）
- `worklogSummarize`（工作日志摘要）
- `jdParse`（JD 解析）
- `scoreDiscovered` / `jobMatch`（用 embedding，**远程 OpenAI embedding 也计费，但当前不记 AiRun token → 需补**）

**Web 侧（API 路由，经 `@/lib/ai` 的 `chat()`）：**
- `writing/generate`（求职信/感谢信/跟进信）
- `negotiation/generate`（薪资谈判话术）
- `tools/scam-checker`（防诈检测）
- `resumes/translate-section`（简历段落翻译）
- `profile/translate`（档案翻译）
- `discovered-jobs/import-url`（从 URL 导入 JD 并解析）

> 关键洞察：所有 AI 调用都包在 `startRun/finishRun`（worker）或 `startAiRun/finishAiRun`（web）里。**只要在这两处 finish 时按 `tokensIn+tokensOut` 扣费，即可自动覆盖全部 AI 操作**，无需逐一改业务代码。

---

## 3. 计费模型（核心设计）

### 3.1 token 单位（**已确认：方案 A**）
- **内部 token 与 AI token 1:1**。余额以"token"计，一次操作扣 `tokensIn + tokensOut`。简单、可解释、与 `AiRun` 数据天然对齐。
- （方案 B 人民币余额本期不做。）

### 3.2 价格表
- `TokenPrice` 表：每个 `model` 存 `inPer1k`（输入单价）、`outPer1k`（输出单价）、`currency`。
- 预置：DeepSeek v4-pro / v4-flash、OpenAI gpt-4.1-mini、text-embedding-3-small 的公开单价（¥/1M 或 ¥/1K）。
- "查询价格"接口直接返回此表，前端展示各模型输入/输出单价与示例成本。

### 3.3 扣费口径
- 内部扣减额 = `tokensIn + tokensOut`（方案 A）。
- 同时把本次真实 ¥ 成本写入 `AiRun.costUsd`（复用已有字段）与 `AiRun.costTokens`（新增），供成本看板。

### 3.4 免费额度与额度调节（**已确认**）
- **免费额度**：新用户注册一次性赠送 `FREE_GRANT` token（默认 5000），**不自动月刷新**（用户选择"仅赠送一次"）。
- **无重置**：任何角色都不能"重置回到基准"。额度只减不增，除非管理员主动发放。
- **用户用完必须充值**：余额耗尽后 AI 操作返回 402，用户需充值才能继续。本期**充值/支付网关不做**（见 1.2），因此：
  - **测试期由管理员代发额度**：管理后台可对任意用户 `grant`（+N，模拟充值/赠送）或 `deduct`（−N，校正多扣/违规），等价于"调节用户额度"。
  - 正式上线后，`grant` 由支付网关在用户充值成功后自动触发（本期留接口、不接真实支付）。
- 由于无自动月刷新、无自助重置，余额不会自动回血；测试期完全依赖管理员发放。

---

## 4. 数据模型（schema.prisma 新增）

```prisma
// 用户 token 余额（每用户一行）
model TokenBalance {
  id              String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  userId          String    @unique @db.Uuid
  balance         Int       @default(0)                  // 当前余额（token）
  freeQuota       Int       @default(5000)               // 注册一次性赠送的初始额度（展示用，非重置基准）
  createdAt       DateTime  @default(now()) @map("created_at") @db.Timestamptz()
  updatedAt       DateTime  @default(now()) @updatedAt @map("updated_at") @db.Timestamptz()
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@map("token_balances")
}

// 流水账（所有变动留痕，支持额度调节审计）
model TokenTransaction {
  id          String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  userId      String   @db.Uuid
  delta       Int                                   // 负=消费，正=发放/重置
  kind        TokenTxKind                           // consume | grant | deduct | expire
  refType     String?                               // ai_run | admin | system
  refId       String?                               // AiRun.id / adminAuditLog.id
  balanceAfter Int                                  // 变动后余额（快照）
  note        String?   @db.VarChar(255)
  createdAt   DateTime @default(now()) @map("created_at") @db.Timestamptz()
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@index([userId, createdAt(sort: Desc)])
  @@map("token_transactions")
}

enum TokenTxKind { consume grant deduct expire }

// 模型价格表（可后台编辑）
model TokenPrice {
  id        String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  model     String   @unique                             // 如 deepseek-v4-pro
  label     String   @db.VarChar(64)
  inPer1k   Decimal  @map("in_per_1k") @db.Decimal(10,6) // ¥ / 1K 输入 token
  outPer1k  Decimal  @map("out_per_1k") @db.Decimal(10,6)
  currency  String   @default("CNY") @db.VarChar(8)
  updatedAt DateTime @default(now()) @updatedAt @map("updated_at") @db.Timestamptz()
  @@map("token_prices")
}
```

> `AiRun` 复用 `costUsd`，并**新增 `costTokens Int?`** 记录本次消耗的内部 token。

---

## 5. 扣费/充值核心库

新建 `apps/web/src/lib/tokens.ts`（web）与 `apps/worker/src/billing/tokens.ts`（worker 共用同一 `@careeros/db`），或抽到 `packages/shared`：

```ts
getBalance(userId): Promise<number>
checkBalance(userId, need): Promise<boolean>          // 预检，不足返回 false
deductTokens(userId, amount, refType, refId, note?): Promise<{ok:boolean; balance:number}>
grantTokens(userId, amount, kind, note?): Promise<number>   // 发放(grant, +N)或扣减(deduct, -N)，管理员调节额度
```

**原子性**：`deductTokens` 用 `prisma.$transaction` 内 `prisma.tokenBalance.update({ data: { balance: { decrement: amount } } })`（DB 级原子）+ 插入 `TokenTransaction`（带 `balanceAfter` 快照）。余额不足时 `checkBalance` 在调用前拦截，避免透支。

---

## 6. 接入点（自动覆盖所有 AI 操作）

| 位置 | 改动 |
|---|---|
| `apps/worker/src/ai/audit.ts` `finishRun` | 计算 `amount = tokensIn + tokensOut`，调用 `deductTokens(userId, amount, "ai_run", runId)`；同时写 `AiRun.costTokens`/`costUsd` |
| `apps/worker/src/ai/audit.ts` `startRun` | 调 `checkBalance(userId, estimate)`（按输入长度粗估），不足抛 `402` |
| `apps/web/src/lib/ai-log.ts` `finishAiRun` | 同上扣费逻辑（web 侧 AI 路由） |
| `apps/web/src/lib/ai-log.ts` `startAiRun` | 同上预检 |
| `scoreDiscovered` / `jobMatch`（embedding） | 目前不记 token → 在任务结束时按文本量估算 embedding token，补建 `AiRun(kind=embedding)` 并扣费（或并入现有 AiRun） |

> mock provider 返回 `tokensIn=tokensOut=0` → 扣费为 0，联调免费，无需特殊处理。

---

## 7. API 设计

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/v1/tokens` | 返回 `{ balance, freeQuota, prices:[...], recentTransactions:[...] }` |
| GET | `/api/v1/tokens/prices` | 价格表（登录可见，前端"价格"弹层用） |
| POST | `/api/admin/tokens/adjust` | 管理员调节额度 `{userId, delta, note}`（`delta>0` 发放/模拟充值，`delta<0` 扣减校正） |
| 402 | 各 AI 路由 | `checkBalance` 失败返回 `402 Payment Required`，文案"token 余额不足" |

> 现有 `writing/generate` 已在 `aiRateLimited` 后、调用前可插入 `checkBalance`；同样模式套用到所有 AI 路由。

---

## 8. 前端 UI

1. **设置页**（`settings/page.tsx`）：新增「Token 额度」卡片
   - 当前余额（大数字）、免费额度进度条（展示已消耗比例）。
   - 折叠区：价格表（各模型输入/输出单价 + 示例成本）。
   - 最近流水列表（消费/发放/扣减，带时间）。
   - 余额不足提示「余额不足，请充值或联系管理员」（无自助重置按钮）。
2. **AI 功能触发处**：余额不足时按钮置灰/提示「余额不足，请充值或联系管理员」；AI 返回 402 时 toast 提示。
3. **管理后台**：用户 token 管理（发放/重置/查看流水 + 全局成本看板，复用 `AiRun.costUsd` 汇总）。

---

## 9. 安全与边界

- **透支防护**：余额不足必须在 `startRun/startAiRun` 预检拦截（402），不允许"先调后扣到负"。
- **并发**：`decrement` 原子更新 + `TokenTransaction` 与余额在同一事务，保证账实一致。
- **价格缺失**：某模型不在 `TokenPrice` 表时，用默认单价或拒绝调用（避免 0 成本钻空子）。
- **记账失败不影响主流程**：扣费异常应告警但不阻断 AI 结果返回（与现有 `finishAiRun.catch` 一致），但需补告警以便对账。
- **隐私**：流水仅本人/管理员可见。

---

## 10. 实施步骤（分阶段）

- **Phase 0 — Schema & 种子**：新增 3 个模型 + `AiRun.costTokens`；`prisma db push`；seed `TokenPrice`（DeepSeek/OpenAI 单价）；为新老用户建 `TokenBalance`（默认免费额度）。
- **Phase 1 — 核心库**：实现 `tokens.ts`（get/check/deduct/grant/reset），加最小单测验证原子扣减与重置。
- **Phase 2 — 接入计量**：改造 worker `audit.finishRun` + web `ai-log.finishAiRun` 扣费；`startRun/startAiRun` 加预检；补 embedding 计量。
- **Phase 3 — API**：实现 `/tokens`、`/tokens/prices`、admin `adjust`；AI 路由接 402。
- **Phase 4 — 前端**：设置页 Token 卡片、价格弹层、流水、重置按钮；AI 触发处余额不足拦截。
- **Phase 5 — 验证**：见第 11 节。

---

## 11. 验证方案

- `pnpm -r --filter worker --filter web run typecheck` 全绿。
- 本地起 `pnpm --filter web dev` + `pnpm --filter worker dev`（均 `unset` HTTP_PROXY）。
- **mock 模式**：无 AI key 时调用 AI 功能，确认不扣费（`tokensIn/out=0`）。
- **真实扣费**：配置 `DEEPSEEK_API_KEY` 后跑一次简历解析，确认 `TokenBalance` 下降、`TokenTransaction` 新增一条 `consume`、`AiRun.costTokens` 有值。
- **价格查询**：`GET /api/v1/tokens/prices` 返回各模型单价。
- **余额不足**：把某用户余额置 0，调 AI 功能确认返回 402 且未实际扣为负。
- **调节额度**：管理员 `POST /api/admin/tokens/adjust` 后确认余额按 `delta` 增减、流水记 `grant`/`deduct`。
- **embedding 计量**：跑一次 `scoreDiscovered`，确认产生 embedding 类扣费记录。

---

## 12. 已确认决策（开工前已拍板）

| 项 | 决策 |
|---|---|
| Token 单位 | 与 AI token 1:1（方案 A），扣 `tokensIn + tokensOut` |
| 免费额度 | 注册一次性赠送 `FREE_GRANT=5000`，**不**自动月刷新 |
| 重置语义 | **无重置**。用户用完需充值（本期充值网关未做，测试期由管理员 grant/deduct 调节额度模拟）；用户无自助重置权限 |
| 价格维护 | seed 写死官方单价（DeepSeek/OpenAI，CNY）+ 后台可编辑（`TokenPrice` 表） |

> 已定：取消一切自助重置。额度只减不增，用户耗尽需充值（本期管理员 grant 模拟充值）；仅管理员可 grant/deduct 调节任意用户额度。
