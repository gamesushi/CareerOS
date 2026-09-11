-- Token 额度系统（docs/token-system-plan.md）
-- 内部 token 与 AI token 1:1：一次 AI 操作扣 tokensIn + tokensOut。

-- AiRun 增加本次消耗的内部 token 与真实 ¥ 成本列
ALTER TABLE "ai_runs" ADD COLUMN "cost_tokens" INTEGER;
ALTER TABLE "ai_runs" ADD COLUMN "cost_usd" DECIMAL(10, 6);

-- 档位枚举（与 schema enum TokenTxKind 保持一致）
CREATE TYPE "token_tx_kind" AS ENUM ('consume', 'grant', 'deduct');

-- 每用户余额
CREATE TABLE "token_balances" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "balance" INTEGER NOT NULL DEFAULT 0,
  "free_quota" INTEGER NOT NULL DEFAULT 30000,
  "tier" VARCHAR(8) NOT NULL DEFAULT 'c',
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "token_balances_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "token_balances_user_id_key" ON "token_balances" ("user_id");
ALTER TABLE "token_balances"
  ADD CONSTRAINT "token_balances_user_id_fkey" FOREIGN KEY ("user_id")
  REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 流水账
CREATE TABLE "token_transactions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "delta" INTEGER NOT NULL,
  "kind" "token_tx_kind" NOT NULL,
  "ref_type" VARCHAR(32),
  "ref_id" UUID,
  "balance_after" INTEGER NOT NULL,
  "note" VARCHAR(255),
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "token_transactions_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "token_transactions_user_id_created_at_idx" ON "token_transactions" ("user_id", "created_at" DESC);
ALTER TABLE "token_transactions"
  ADD CONSTRAINT "token_transactions_user_id_fkey" FOREIGN KEY ("user_id")
  REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 模型价格表
CREATE TABLE "token_prices" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "model" VARCHAR(64) NOT NULL,
  "label" VARCHAR(64) NOT NULL,
  "in_per_1k" DECIMAL(10, 6) NOT NULL,
  "out_per_1k" DECIMAL(10, 6) NOT NULL,
  "currency" VARCHAR(8) NOT NULL DEFAULT 'CNY',
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "token_prices_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "token_prices_model_key" ON "token_prices" ("model");
