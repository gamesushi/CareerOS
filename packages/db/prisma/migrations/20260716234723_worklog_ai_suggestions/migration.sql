-- DropIndex
DROP INDEX "idx_exp_company_trgm";

-- DropIndex
DROP INDEX "idx_skill_name_trgm";

-- DropIndex
DROP INDEX "idx_wl_tags";

-- AlterTable
ALTER TABLE "work_logs" ADD COLUMN     "ai_suggestions" JSONB;
