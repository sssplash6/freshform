-- "Student file" is called the student's FOLDER everywhere in the business, so
-- the column follows the language staff actually use. Rename, never re-create:
-- the links already attached to students must survive.
-- AlterTable
ALTER TABLE "StudentProfile" RENAME COLUMN "fileUrl" TO "folderUrl";
