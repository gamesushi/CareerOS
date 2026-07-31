/*
  Warnings:

  - The `languages` column on the `users` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "work_auth_status" AS ENUM ('us_authorized', 'requires_sponsorship', 'other');

-- CreateEnum
CREATE TYPE "language_proficiency" AS ENUM ('native', 'fluent', 'professional', 'conversational', 'basic');

-- AlterTable
ALTER TABLE "discovered_jobs" ADD COLUMN     "categories" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "experience" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "languages" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "regions" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "roles" JSONB NOT NULL DEFAULT '[]';

-- AlterTable
ALTER TABLE "educations" ADD COLUMN     "faculty" VARCHAR(128);

-- AlterTable
ALTER TABLE "job_watches" ADD COLUMN     "matchCategories" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "match_experience" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "match_languages" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "match_regions" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "match_roles" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "mobile" VARCHAR(64),
ADD COLUMN     "preferred_city" VARCHAR(128),
ADD COLUMN     "sns_links" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "work_auth_status" "work_auth_status",
DROP COLUMN "languages",
ADD COLUMN     "languages" JSONB NOT NULL DEFAULT '[]';

-- CreateTable
CREATE TABLE "honors" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "issuer" VARCHAR(160),
    "date" DATE,
    "description" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "honors_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "honors_user_id_idx" ON "honors"("user_id");

-- AddForeignKey
ALTER TABLE "honors" ADD CONSTRAINT "honors_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
