-- AlterTable
ALTER TABLE "users" ADD COLUMN     "tos_accepted_at" TIMESTAMPTZ,
ADD COLUMN     "tos_version" VARCHAR(32);
