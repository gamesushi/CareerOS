-- 补记既有漂移：这两列此前由 `prisma db push` 直接加到开发库，未留迁移记录。
-- 内容与线上/开发库现状一致，用 IF NOT EXISTS 保证在已有该列的库上重复执行安全。
ALTER TABLE "careeros"."discovered_jobs" ADD COLUMN IF NOT EXISTS "closed_at" TIMESTAMPTZ(6);
ALTER TABLE "careeros"."job_watches" ADD COLUMN IF NOT EXISTS "last_result" TEXT;
