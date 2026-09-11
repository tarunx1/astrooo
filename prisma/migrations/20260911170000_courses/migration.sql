-- Courses: level, syllabus outline, instructor and paid enrolment.
--
-- Entirely additive. Every new column on Course and Enrollment is nullable or
-- carries a default, so an existing row would survive unchanged. Both tables
-- are empty at the time of writing.
--
-- Deliberately absent: a Lesson table and any progress column. Inventing either
-- would mean showing a learner a completion percentage this application cannot
-- measure. When real lesson delivery exists it gets its own migration.

-- CreateEnum
CREATE TYPE "CourseLevel" AS ENUM ('BEGINNER', 'INTERMEDIATE', 'ADVANCED');

-- AlterTable
ALTER TABLE "Course" ADD COLUMN     "coverImageUrl" TEXT,
ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'INR',
ADD COLUMN     "durationMinutes" INTEGER,
ADD COLUMN     "instructorName" TEXT,
ADD COLUMN     "level" "CourseLevel" NOT NULL DEFAULT 'BEGINNER',
ADD COLUMN     "shortDescription" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "sortOrder" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "syllabus" JSONB;

-- AlterTable
ALTER TABLE "Enrollment" ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'INR',
ADD COLUMN     "paidAt" TIMESTAMP(3),
ADD COLUMN     "pricePaise" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "providerOrderId" TEXT;

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "enrollmentId" TEXT;

-- CreateIndex
CREATE INDEX "Course_active_sortOrder_idx" ON "Course"("active", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "Enrollment_providerOrderId_key" ON "Enrollment"("providerOrderId");

-- CreateIndex
CREATE INDEX "Payment_enrollmentId_idx" ON "Payment"("enrollmentId");

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
