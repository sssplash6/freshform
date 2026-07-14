-- AlterTable
ALTER TABLE "Session" ADD COLUMN "task" TEXT;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_MentorAssignment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "mentorId" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "cohortId" TEXT,
    "calendlyUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MentorAssignment_mentorId_fkey" FOREIGN KEY ("mentorId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "MentorAssignment_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "MentorAssignment_cohortId_fkey" FOREIGN KEY ("cohortId") REFERENCES "Cohort" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_MentorAssignment" ("calendlyUrl", "cohortId", "createdAt", "id", "mentorId", "programId") SELECT "calendlyUrl", "cohortId", "createdAt", "id", "mentorId", "programId" FROM "MentorAssignment";
DROP TABLE "MentorAssignment";
ALTER TABLE "new_MentorAssignment" RENAME TO "MentorAssignment";
CREATE UNIQUE INDEX "MentorAssignment_mentorId_programId_cohortId_key" ON "MentorAssignment"("mentorId", "programId", "cohortId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
