-- 修复 token 系统迁移在 prod 的部分应用：
-- 上一轮 migrate 因 ai_runs.cost_usd 已存在而 P3018 失败，导致 token_* 三张表未建成。
-- 本迁移全部用 IF NOT EXISTS / 存在性判断，幂等可重复执行，无论中间态如何都能收敛到目标结构。
-- 原始 20260911000000_token_system 将在远程用 `prisma migrate resolve --applied` 标记为已应用。

-- 1) ai_runs 补充消耗列（若已存在则跳过）
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'careeros' AND table_name = 'ai_runs' AND column_name = 'cost_tokens'
  ) THEN
    ALTER TABLE "ai_runs" ADD COLUMN "cost_tokens" INTEGER;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'careeros' AND table_name = 'ai_runs' AND column_name = 'cost_usd'
  ) THEN
    ALTER TABLE "ai_runs" ADD COLUMN "cost_usd" DECIMAL(10, 6);
  END IF;
END $$;

-- 2) 档位枚举（已存在则跳过）
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'token_tx_kind'
  ) THEN
    CREATE TYPE "token_tx_kind" AS ENUM ('consume', 'grant', 'deduct');
  END IF;
END $$;

-- 3) token_balances
CREATE TABLE IF NOT EXISTS "token_balances" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "balance" INTEGER NOT NULL DEFAULT 0,
  "free_quota" INTEGER NOT NULL DEFAULT 30000,
  "tier" VARCHAR(8) NOT NULL DEFAULT 'c',
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "token_balances_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "token_balances_user_id_key" ON "token_balances" ("user_id");
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'token_balances_user_id_fkey') THEN
    ALTER TABLE "token_balances"
      ADD CONSTRAINT "token_balances_user_id_fkey" FOREIGN KEY ("user_id")
      REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- 4) token_transactions
CREATE TABLE IF NOT EXISTS "token_transactions" (
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
CREATE INDEX IF NOT EXISTS "token_transactions_user_id_created_at_idx" ON "token_transactions" ("user_id", "created_at" DESC);
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'token_transactions_user_id_fkey') THEN
    ALTER TABLE "token_transactions"
      ADD CONSTRAINT "token_transactions_user_id_fkey" FOREIGN KEY ("user_id")
      REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- 5) token_prices
CREATE TABLE IF NOT EXISTS "token_prices" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "model" VARCHAR(64) NOT NULL,
  "label" VARCHAR(64) NOT NULL,
  "in_per_1k" DECIMAL(10, 6) NOT NULL,
  "out_per_1k" DECIMAL(10, 6) NOT NULL,
  "currency" VARCHAR(8) NOT NULL DEFAULT 'CNY',
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "token_prices_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "token_prices_model_key" ON "token_prices" ("model");
