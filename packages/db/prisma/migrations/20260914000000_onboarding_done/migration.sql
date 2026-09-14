-- 新增：用户是否已完成新手引导标记（仪表盘据此不再提示引导）
-- 幂等：若列已存在则跳过，避免与历史偏应用迁移冲突
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "onboarding_done" BOOLEAN NOT NULL DEFAULT false;
