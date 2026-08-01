-- AlterTable
ALTER TABLE "resumes" ADD COLUMN     "source_resume_id" UUID;

-- AddForeignKey
ALTER TABLE "resumes" ADD CONSTRAINT "resumes_source_resume_id_fkey" FOREIGN KEY ("source_resume_id") REFERENCES "resumes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
