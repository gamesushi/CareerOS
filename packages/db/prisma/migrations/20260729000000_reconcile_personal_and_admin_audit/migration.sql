-- Reconciliation baseline（2026-07-29）
-- 补齐历史上经 `db push` 直接进库、但从未落入迁移历史的两处变更：
--   1) career_profiles.personal 列（个人信息/多地区，早期 push 引入的漂移）
--   2) admin_action 枚举 + admin_audit_logs 表（管理后台审计，P0-2 引入）
--
-- 幂等 DDL：dev 库已有这些对象（本迁移在 dev 用 `prisma migrate resolve --applied` 标记，不实际执行）；
-- 生产 `prisma migrate deploy` 时一次性创建。IF NOT EXISTS / EXCEPTION 守卫保证在任一环境重复执行都安全。

-- AlterTable
ALTER TABLE "career_profiles" ADD COLUMN IF NOT EXISTS "personal" JSONB NOT NULL DEFAULT '{}';

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "admin_action" AS ENUM ('user_role_change', 'user_soft_delete', 'user_restore', 'user_ban', 'job_takedown', 'source_toggle', 'other');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "admin_audit_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "actor_id" UUID NOT NULL,
    "action" "admin_action" NOT NULL,
    "target_type" VARCHAR(32) NOT NULL,
    "target_id" UUID,
    "before" JSONB,
    "after" JSONB,
    "reason" VARCHAR(500),
    "ip" VARCHAR(64),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "admin_audit_logs_actor_id_created_at_idx" ON "admin_audit_logs"("actor_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "admin_audit_logs_target_type_target_id_idx" ON "admin_audit_logs"("target_type", "target_id");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "admin_audit_logs" ADD CONSTRAINT "admin_audit_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
