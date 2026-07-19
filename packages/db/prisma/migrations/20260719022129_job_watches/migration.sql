-- CreateEnum
CREATE TYPE "discovered_job_status" AS ENUM ('new', 'viewed', 'imported', 'dismissed');

-- CreateTable
CREATE TABLE "job_watches" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "keywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "sources" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "locations" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "interval_minutes" INTEGER NOT NULL DEFAULT 60,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "last_run_at" TIMESTAMPTZ,
    "last_error" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "job_watches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "discovered_jobs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "watch_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "source" VARCHAR(32) NOT NULL,
    "external_id" VARCHAR(128) NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "company" VARCHAR(128),
    "location" VARCHAR(128),
    "salary" VARCHAR(64),
    "url" TEXT NOT NULL,
    "snippet" TEXT,
    "published_at" TIMESTAMPTZ,
    "raw" JSONB,
    "status" "discovered_job_status" NOT NULL DEFAULT 'new',
    "jd_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "discovered_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "job_watches_enabled_last_run_at_idx" ON "job_watches"("enabled", "last_run_at");

-- CreateIndex
CREATE INDEX "discovered_jobs_user_id_status_created_at_idx" ON "discovered_jobs"("user_id", "status", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "discovered_jobs_watch_id_source_external_id_key" ON "discovered_jobs"("watch_id", "source", "external_id");

-- AddForeignKey
ALTER TABLE "job_watches" ADD CONSTRAINT "job_watches_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "discovered_jobs" ADD CONSTRAINT "discovered_jobs_watch_id_fkey" FOREIGN KEY ("watch_id") REFERENCES "job_watches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "discovered_jobs" ADD CONSTRAINT "discovered_jobs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "discovered_jobs" ADD CONSTRAINT "discovered_jobs_jd_id_fkey" FOREIGN KEY ("jd_id") REFERENCES "job_descriptions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
