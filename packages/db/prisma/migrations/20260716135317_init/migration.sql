-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "citext";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "vector";

-- CreateEnum
CREATE TYPE "user_role" AS ENUM ('guest', 'user', 'recruiter', 'admin', 'enterprise');

-- CreateEnum
CREATE TYPE "job_status" AS ENUM ('open', 'passive', 'closed');

-- CreateEnum
CREATE TYPE "entity_source" AS ENUM ('manual', 'import', 'ai');

-- CreateEnum
CREATE TYPE "import_status" AS ENUM ('pending', 'parsing', 'extracting', 'review', 'applied', 'failed');

-- CreateEnum
CREATE TYPE "jd_status" AS ENUM ('pending', 'parsing', 'parsed', 'failed');

-- CreateEnum
CREATE TYPE "resume_type" AS ENUM ('zh', 'en', 'ja_shokumu', 'linkedin', 'cover_letter');

-- CreateEnum
CREATE TYPE "resume_status" AS ENUM ('draft', 'final', 'archived');

-- CreateEnum
CREATE TYPE "evidence_source" AS ENUM ('project', 'experience', 'work_log', 'achievement', 'certificate', 'external');

-- CreateEnum
CREATE TYPE "worklog_source" AS ENUM ('manual', 'voice', 'email', 'notion', 'github');

-- CreateEnum
CREATE TYPE "connection_type" AS ENUM ('follow', 'friend', 'colleague');

-- CreateEnum
CREATE TYPE "connection_status" AS ENUM ('pending', 'accepted', 'blocked');

-- CreateEnum
CREATE TYPE "ai_run_kind" AS ENUM ('resume_parse', 'jd_parse', 'resume_generate', 'profile_generate', 'worklog_summarize', 'job_match', 'skill_extract', 'translate');

-- CreateEnum
CREATE TYPE "ai_run_status" AS ENUM ('queued', 'running', 'succeeded', 'failed');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "email" CITEXT NOT NULL,
    "name" VARCHAR(128) NOT NULL,
    "email_verified" TIMESTAMP(3),
    "avatar_url" TEXT,
    "role" "user_role" NOT NULL DEFAULT 'user',
    "locale" VARCHAR(8) NOT NULL DEFAULT 'zh',
    "region" VARCHAR(64),
    "languages" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "job_status" "job_status" NOT NULL DEFAULT 'passive',
    "privacy" JSONB NOT NULL DEFAULT '{"profile_public": false, "resume_searchable": false, "recruiter_contact": false, "feed_visible": false}',
    "weknora_kb_id" VARCHAR(64),
    "weknora_api_key" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "provider_account_id" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "session_token" TEXT NOT NULL,
    "user_id" UUID NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_tokens" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "career_profiles" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "headline" VARCHAR(128),
    "summary" TEXT,
    "career_tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "career_level" VARCHAR(32),
    "years_experience" DECIMAL(4,1),
    "industry_tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "is_stale" BOOLEAN NOT NULL DEFAULT true,
    "generated_run_id" UUID,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "career_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "career_experiences" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "company" VARCHAR(128) NOT NULL,
    "company_norm" VARCHAR(128) NOT NULL,
    "title" VARCHAR(128) NOT NULL,
    "employment_type" VARCHAR(32),
    "start_date" DATE NOT NULL,
    "end_date" DATE,
    "location" VARCHAR(128),
    "description" TEXT,
    "highlights" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "lang" VARCHAR(8) NOT NULL DEFAULT 'zh',
    "source" "entity_source" NOT NULL DEFAULT 'manual',
    "import_id" UUID,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "career_experiences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projects" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "experience_id" UUID,
    "name" VARCHAR(160) NOT NULL,
    "role" VARCHAR(128),
    "start_date" DATE,
    "end_date" DATE,
    "description" TEXT,
    "outcome" TEXT,
    "links" JSONB NOT NULL DEFAULT '[]',
    "tech_stack" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "lang" VARCHAR(8) NOT NULL DEFAULT 'zh',
    "source" "entity_source" NOT NULL DEFAULT 'manual',
    "import_id" UUID,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "skills" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "name_norm" VARCHAR(80) NOT NULL,
    "category" VARCHAR(48),
    "level" SMALLINT NOT NULL DEFAULT 0,
    "level_source" "entity_source" NOT NULL DEFAULT 'manual',
    "first_used_at" DATE,
    "last_used_at" DATE,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "skills_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "skill_evidences" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "skill_id" UUID NOT NULL,
    "source_type" "evidence_source" NOT NULL,
    "source_id" UUID,
    "note" TEXT,
    "url" TEXT,
    "weight" SMALLINT NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "skill_evidences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "achievements" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "experience_id" UUID,
    "project_id" UUID,
    "title" VARCHAR(200) NOT NULL,
    "metric_value" DECIMAL(65,30),
    "metric_unit" VARCHAR(32),
    "metric_text" VARCHAR(120),
    "evidence" TEXT,
    "occurred_at" DATE,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "achievements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "educations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "school" VARCHAR(160) NOT NULL,
    "degree" VARCHAR(64),
    "major" VARCHAR(128),
    "start_date" DATE,
    "end_date" DATE,
    "gpa" VARCHAR(16),
    "description" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "educations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "log_date" DATE NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "content" TEXT NOT NULL,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "ai_summary" TEXT,
    "source" "worklog_source" NOT NULL DEFAULT 'manual',
    "external_ref" JSONB,
    "weknora_knowledge_id" VARCHAR(64),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "work_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_log_projects" (
    "work_log_id" UUID NOT NULL,
    "project_id" UUID NOT NULL,

    CONSTRAINT "work_log_projects_pkey" PRIMARY KEY ("work_log_id","project_id")
);

-- CreateTable
CREATE TABLE "work_log_skills" (
    "work_log_id" UUID NOT NULL,
    "skill_id" UUID NOT NULL,

    CONSTRAINT "work_log_skills_pkey" PRIMARY KEY ("work_log_id","skill_id")
);

-- CreateTable
CREATE TABLE "project_skills" (
    "project_id" UUID NOT NULL,
    "skill_id" UUID NOT NULL,

    CONSTRAINT "project_skills_pkey" PRIMARY KEY ("project_id","skill_id")
);

-- CreateTable
CREATE TABLE "resume_imports" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "file_key" TEXT NOT NULL,
    "file_name" VARCHAR(255) NOT NULL,
    "mime_type" VARCHAR(128) NOT NULL,
    "status" "import_status" NOT NULL DEFAULT 'pending',
    "raw_text" TEXT,
    "extracted" JSONB,
    "applied_diff" JSONB,
    "error" TEXT,
    "weknora_knowledge_id" VARCHAR(64),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "resume_imports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_descriptions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "company" VARCHAR(128),
    "title" VARCHAR(160),
    "source_url" TEXT,
    "file_key" TEXT,
    "raw_content" TEXT NOT NULL,
    "lang" VARCHAR(8),
    "status" "jd_status" NOT NULL DEFAULT 'pending',
    "parsed" JSONB,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "job_descriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_matches" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "jd_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "match_score" DECIMAL(5,2) NOT NULL,
    "skill_coverage" DECIMAL(5,2) NOT NULL,
    "experience_coverage" DECIMAL(5,2) NOT NULL,
    "industry_coverage" DECIMAL(5,2) NOT NULL,
    "missing_skills" JSONB NOT NULL DEFAULT '[]',
    "matched_evidence" JSONB NOT NULL DEFAULT '[]',
    "resume_id" UUID,
    "run_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "job_matches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "resumes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "title" VARCHAR(160) NOT NULL,
    "resume_type" "resume_type" NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "template_id" VARCHAR(64) NOT NULL DEFAULT 'openresume-classic',
    "resume_json" JSONB NOT NULL,
    "jd_id" UUID,
    "status" "resume_status" NOT NULL DEFAULT 'draft',
    "pdf_file_key" TEXT,
    "generated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "resumes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "connections" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "target_user_id" UUID NOT NULL,
    "type" "connection_type" NOT NULL,
    "status" "connection_status" NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "embeddings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "source_type" VARCHAR(32) NOT NULL,
    "source_id" UUID NOT NULL,
    "content_hash" VARCHAR(64) NOT NULL,
    "model_id" VARCHAR(64) NOT NULL,
    "dimension" INTEGER NOT NULL,
    "embedding" halfvec NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "embeddings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_runs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID,
    "kind" "ai_run_kind" NOT NULL,
    "status" "ai_run_status" NOT NULL DEFAULT 'queued',
    "input_ref" JSONB,
    "model" VARCHAR(64),
    "prompt_version" VARCHAR(32),
    "tokens_in" INTEGER,
    "tokens_out" INTEGER,
    "cost_usd" DECIMAL(10,6),
    "latency_ms" INTEGER,
    "error" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMPTZ,

    CONSTRAINT "ai_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_provider_provider_account_id_key" ON "accounts"("provider", "provider_account_id");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_session_token_key" ON "sessions"("session_token");

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_token_key" ON "verification_tokens"("token");

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_identifier_token_key" ON "verification_tokens"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "career_profiles_user_id_key" ON "career_profiles"("user_id");

-- CreateIndex
CREATE INDEX "career_experiences_user_id_start_date_idx" ON "career_experiences"("user_id", "start_date" DESC);

-- CreateIndex
CREATE INDEX "projects_user_id_start_date_idx" ON "projects"("user_id", "start_date" DESC);

-- CreateIndex
CREATE INDEX "projects_experience_id_idx" ON "projects"("experience_id");

-- CreateIndex
CREATE UNIQUE INDEX "skills_user_id_name_norm_key" ON "skills"("user_id", "name_norm");

-- CreateIndex
CREATE INDEX "skill_evidences_source_type_source_id_idx" ON "skill_evidences"("source_type", "source_id");

-- CreateIndex
CREATE UNIQUE INDEX "skill_evidences_skill_id_source_type_source_id_key" ON "skill_evidences"("skill_id", "source_type", "source_id");

-- CreateIndex
CREATE INDEX "achievements_user_id_idx" ON "achievements"("user_id");

-- CreateIndex
CREATE INDEX "achievements_experience_id_idx" ON "achievements"("experience_id");

-- CreateIndex
CREATE INDEX "achievements_project_id_idx" ON "achievements"("project_id");

-- CreateIndex
CREATE INDEX "educations_user_id_idx" ON "educations"("user_id");

-- CreateIndex
CREATE INDEX "work_logs_user_id_log_date_idx" ON "work_logs"("user_id", "log_date" DESC);

-- CreateIndex
CREATE INDEX "resume_imports_user_id_created_at_idx" ON "resume_imports"("user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "job_descriptions_user_id_created_at_idx" ON "job_descriptions"("user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "job_matches_jd_id_created_at_idx" ON "job_matches"("jd_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "resumes_user_id_updated_at_idx" ON "resumes"("user_id", "updated_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "connections_user_id_target_user_id_type_key" ON "connections"("user_id", "target_user_id", "type");

-- CreateIndex
CREATE INDEX "embeddings_user_id_source_type_idx" ON "embeddings"("user_id", "source_type");

-- CreateIndex
CREATE UNIQUE INDEX "embeddings_source_type_source_id_model_id_key" ON "embeddings"("source_type", "source_id", "model_id");

-- CreateIndex
CREATE INDEX "ai_runs_user_id_created_at_idx" ON "ai_runs"("user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "ai_runs_kind_status_idx" ON "ai_runs"("kind", "status");

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "career_profiles" ADD CONSTRAINT "career_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "career_experiences" ADD CONSTRAINT "career_experiences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "career_experiences" ADD CONSTRAINT "career_experiences_import_id_fkey" FOREIGN KEY ("import_id") REFERENCES "resume_imports"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_experience_id_fkey" FOREIGN KEY ("experience_id") REFERENCES "career_experiences"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_import_id_fkey" FOREIGN KEY ("import_id") REFERENCES "resume_imports"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skills" ADD CONSTRAINT "skills_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skill_evidences" ADD CONSTRAINT "skill_evidences_skill_id_fkey" FOREIGN KEY ("skill_id") REFERENCES "skills"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "achievements" ADD CONSTRAINT "achievements_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "achievements" ADD CONSTRAINT "achievements_experience_id_fkey" FOREIGN KEY ("experience_id") REFERENCES "career_experiences"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "achievements" ADD CONSTRAINT "achievements_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "educations" ADD CONSTRAINT "educations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_logs" ADD CONSTRAINT "work_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_log_projects" ADD CONSTRAINT "work_log_projects_work_log_id_fkey" FOREIGN KEY ("work_log_id") REFERENCES "work_logs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_log_projects" ADD CONSTRAINT "work_log_projects_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_log_skills" ADD CONSTRAINT "work_log_skills_work_log_id_fkey" FOREIGN KEY ("work_log_id") REFERENCES "work_logs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_log_skills" ADD CONSTRAINT "work_log_skills_skill_id_fkey" FOREIGN KEY ("skill_id") REFERENCES "skills"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_skills" ADD CONSTRAINT "project_skills_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_skills" ADD CONSTRAINT "project_skills_skill_id_fkey" FOREIGN KEY ("skill_id") REFERENCES "skills"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resume_imports" ADD CONSTRAINT "resume_imports_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_descriptions" ADD CONSTRAINT "job_descriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_matches" ADD CONSTRAINT "job_matches_jd_id_fkey" FOREIGN KEY ("jd_id") REFERENCES "job_descriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_matches" ADD CONSTRAINT "job_matches_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_matches" ADD CONSTRAINT "job_matches_resume_id_fkey" FOREIGN KEY ("resume_id") REFERENCES "resumes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resumes" ADD CONSTRAINT "resumes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resumes" ADD CONSTRAINT "resumes_jd_id_fkey" FOREIGN KEY ("jd_id") REFERENCES "job_descriptions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "connections" ADD CONSTRAINT "connections_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "connections" ADD CONSTRAINT "connections_target_user_id_fkey" FOREIGN KEY ("target_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "embeddings" ADD CONSTRAINT "embeddings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_runs" ADD CONSTRAINT "ai_runs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
