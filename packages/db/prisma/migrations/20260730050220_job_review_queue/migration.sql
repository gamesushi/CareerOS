-- CreateEnum
CREATE TYPE "job_review_status" AS ENUM ('pending', 'approved', 'rejected');

-- AlterTable
ALTER TABLE "discovered_jobs" ADD COLUMN     "review_note" VARCHAR(500),
ADD COLUMN     "review_status" "job_review_status" NOT NULL DEFAULT 'approved',
ADD COLUMN     "reviewed_at" TIMESTAMPTZ,
ADD COLUMN     "reviewed_by_id" UUID;

-- CreateIndex
CREATE INDEX "discovered_jobs_review_status_created_at_idx" ON "discovered_jobs"("review_status", "created_at" DESC);
