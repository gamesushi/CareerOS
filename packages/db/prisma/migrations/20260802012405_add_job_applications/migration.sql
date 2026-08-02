-- CreateEnum
CREATE TYPE "job_application_status" AS ENUM ('submitted', 'screening', 'interview', 'offer', 'rejected', 'withdrawn');

-- CreateTable
CREATE TABLE "job_applications" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "job_posting_id" UUID NOT NULL,
    "candidate_id" UUID NOT NULL,
    "resume_id" UUID,
    "cover_letter" TEXT,
    "status" "job_application_status" NOT NULL DEFAULT 'submitted',
    "employer_note" VARCHAR(1000),
    "status_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "job_applications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "job_applications_job_posting_id_status_created_at_idx" ON "job_applications"("job_posting_id", "status", "created_at" DESC);

-- CreateIndex
CREATE INDEX "job_applications_candidate_id_created_at_idx" ON "job_applications"("candidate_id", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "job_applications_job_posting_id_candidate_id_key" ON "job_applications"("job_posting_id", "candidate_id");

-- AddForeignKey
ALTER TABLE "job_applications" ADD CONSTRAINT "job_applications_job_posting_id_fkey" FOREIGN KEY ("job_posting_id") REFERENCES "job_postings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_applications" ADD CONSTRAINT "job_applications_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_applications" ADD CONSTRAINT "job_applications_resume_id_fkey" FOREIGN KEY ("resume_id") REFERENCES "resumes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
