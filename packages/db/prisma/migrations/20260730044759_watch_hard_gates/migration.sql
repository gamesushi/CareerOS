-- AlterTable
ALTER TABLE "job_watches" ADD COLUMN     "exclude_keywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "max_age_days" INTEGER;
