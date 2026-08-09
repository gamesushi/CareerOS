-- CreateEnum
CREATE TYPE "poster_role" AS ENUM ('hr', 'hiring_manager', 'employee_referral');

-- CreateEnum
CREATE TYPE "company_stage" AS ENUM ('unregistered', 'startup_0_3', 'growth_3_5', 'stable_5_10', 'mature_10plus');

-- AlterTable
ALTER TABLE "job_postings" ADD COLUMN     "company_stage" "company_stage" NOT NULL DEFAULT 'unregistered',
ADD COLUMN     "poster_role" "poster_role" NOT NULL DEFAULT 'hr',
ALTER COLUMN "org_type" DROP NOT NULL;
