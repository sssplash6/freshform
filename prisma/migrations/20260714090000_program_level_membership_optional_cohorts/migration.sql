-- Students and mentor assignments now attach to a Program directly; cohorts
-- only exist under the Global Admissions Program. Hand-written because the
-- new required programId columns are backfilled from each row's old cohort.

-- New fixed program list: rename the existing programs to their new names so
-- students, staff scopes, and assignments carry over.
UPDATE "Program" SET "name" = 'Global Admissions Program' WHERE "name" = 'Admissions Program';
UPDATE "Program" SET "name" = 'Flexible Program' WHERE "name" = 'Global Support';
UPDATE "Program" SET "name" = 'Master''s Program' WHERE "name" = 'Master''s';

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_MentorAssignment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "mentorId" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "cohortId" TEXT,
    "calendlyUrl" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MentorAssignment_mentorId_fkey" FOREIGN KEY ("mentorId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "MentorAssignment_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "MentorAssignment_cohortId_fkey" FOREIGN KEY ("cohortId") REFERENCES "Cohort" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_MentorAssignment" ("id", "mentorId", "programId", "cohortId", "calendlyUrl", "createdAt")
SELECT ma."id", ma."mentorId", c."programId", ma."cohortId", ma."calendlyUrl", ma."createdAt"
FROM "MentorAssignment" ma
JOIN "Cohort" c ON c."id" = ma."cohortId";
DROP TABLE "MentorAssignment";
ALTER TABLE "new_MentorAssignment" RENAME TO "MentorAssignment";
CREATE UNIQUE INDEX "MentorAssignment_mentorId_programId_cohortId_key" ON "MentorAssignment"("mentorId", "programId", "cohortId");
CREATE TABLE "new_StudentProfile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "cohortId" TEXT,
    "telegramUsername" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "StudentProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "StudentProfile_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "StudentProfile_cohortId_fkey" FOREIGN KEY ("cohortId") REFERENCES "Cohort" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "StudentProfile_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_StudentProfile" ("id", "userId", "programId", "cohortId", "telegramUsername", "createdById", "createdAt", "updatedAt")
SELECT sp."id", sp."userId", c."programId", sp."cohortId", NULL, sp."createdById", sp."createdAt", sp."updatedAt"
FROM "StudentProfile" sp
JOIN "Cohort" c ON c."id" = sp."cohortId";
DROP TABLE "StudentProfile";
ALTER TABLE "new_StudentProfile" RENAME TO "StudentProfile";
CREATE UNIQUE INDEX "StudentProfile_userId_key" ON "StudentProfile"("userId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- Cohorts only exist under the Global Admissions Program: detach students and
-- mentor assignments in the other programs from their old cohorts, collapse
-- assignments that became duplicate program-wide rows, then drop the cohorts.
UPDATE "StudentProfile" SET "cohortId" = NULL
WHERE "programId" IN (SELECT "id" FROM "Program" WHERE "name" <> 'Global Admissions Program');
UPDATE "MentorAssignment" SET "cohortId" = NULL
WHERE "programId" IN (SELECT "id" FROM "Program" WHERE "name" <> 'Global Admissions Program');
DELETE FROM "MentorAssignment" WHERE "cohortId" IS NULL AND "rowid" NOT IN (
  SELECT MIN("rowid") FROM "MentorAssignment" WHERE "cohortId" IS NULL GROUP BY "mentorId", "programId"
);
DELETE FROM "Cohort"
WHERE "programId" IN (SELECT "id" FROM "Program" WHERE "name" <> 'Global Admissions Program');
