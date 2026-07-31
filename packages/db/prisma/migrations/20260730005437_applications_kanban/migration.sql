-- CreateEnum
CREATE TYPE "application_stage" AS ENUM ('considering', 'applied', 'screening', 'interview', 'offer', 'rejected');

-- CreateTable
CREATE TABLE "applications" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "discovered_job_id" UUID,
    "jd_id" UUID,
    "resume_id" UUID,
    "title" VARCHAR(200) NOT NULL,
    "company" VARCHAR(128),
    "location" VARCHAR(128),
    "url" TEXT,
    "salary" VARCHAR(64),
    "source" VARCHAR(32),
    "stage" "application_stage" NOT NULL DEFAULT 'considering',
    "match_score" DOUBLE PRECISION,
    "notes" TEXT,
    "next_action" VARCHAR(200),
    "next_action_at" TIMESTAMPTZ,
    "position" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "application_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "application_id" UUID NOT NULL,
    "kind" VARCHAR(24) NOT NULL,
    "from_stage" "application_stage",
    "to_stage" "application_stage",
    "note" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "application_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "applications_user_id_stage_position_idx" ON "applications"("user_id", "stage", "position");

-- CreateIndex
CREATE INDEX "applications_user_id_discovered_job_id_idx" ON "applications"("user_id", "discovered_job_id");

-- CreateIndex
CREATE INDEX "application_events_application_id_created_at_idx" ON "application_events"("application_id", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_resume_id_fkey" FOREIGN KEY ("resume_id") REFERENCES "resumes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_events" ADD CONSTRAINT "application_events_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;
