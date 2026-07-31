-- AlterTable
ALTER TABLE "discovered_jobs" ADD COLUMN     "taken_down_at" TIMESTAMPTZ,
ADD COLUMN     "taken_down_by_id" UUID;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "banned_at" TIMESTAMPTZ;
