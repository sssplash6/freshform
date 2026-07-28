-- The student's file: a link (Google Drive / Docs / Notion …) staff attach when
-- registering the student, so mentors can open it from the student's row or page.
-- Nullable: students registered before this, and self-signups, have no file yet.
-- AlterTable
ALTER TABLE "StudentProfile" ADD COLUMN "fileUrl" TEXT;
