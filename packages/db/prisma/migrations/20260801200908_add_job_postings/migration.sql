-- CreateEnum
CREATE TYPE "org_type" AS ENUM ('individual_hr', 'startup', 'non_company_team', 'enterprise');

-- CreateEnum
CREATE TYPE "job_posting_status" AS ENUM ('draft', 'open', 'closed');

-- CreateTable
CREATE TABLE "job_postings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "posted_by_user_id" UUID NOT NULL,
    "org_id" UUID,
    "org_type" "org_type" NOT NULL,
    "company" VARCHAR(128) NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "location" VARCHAR(128),
    "salary" VARCHAR(64),
    "description" TEXT NOT NULL,
    "url" TEXT,
    "categories" JSONB NOT NULL DEFAULT '[]',
    "status" "job_posting_status" NOT NULL DEFAULT 'draft',
    "review_status" "job_review_status" NOT NULL DEFAULT 'pending',
    "reviewed_at" TIMESTAMPTZ,
    "reviewed_by_id" UUID,
    "review_note" VARCHAR(500),
    "taken_down_at" TIMESTAMPTZ,
    "taken_down_by_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closed_at" TIMESTAMPTZ,

    CONSTRAINT "job_postings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "job_postings_status_review_status_created_at_idx" ON "job_postings"("status", "review_status", "created_at" DESC);

-- CreateIndex
CREATE INDEX "job_postings_posted_by_user_id_created_at_idx" ON "job_postings"("posted_by_user_id", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "job_postings" ADD CONSTRAINT "job_postings_posted_by_user_id_fkey" FOREIGN KEY ("posted_by_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
