-- AlterTable
ALTER TABLE "discovered_jobs" ADD COLUMN     "match_reasons" JSONB,
ADD COLUMN     "match_score" DOUBLE PRECISION;
