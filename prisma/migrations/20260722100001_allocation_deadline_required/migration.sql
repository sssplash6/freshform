-- Deadlines are now REQUIRED on every hour allocation. Once a deadline passes,
-- the allocation's unused hours are forfeited (enforced in application code).
-- Pre-existing allocations had no deadline; backfill them to a far-future date
-- so their hours are not retroactively invalidated. An admin can shorten the
-- deadline afterwards.
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_HourAllocation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "studentId" TEXT NOT NULL,
    "mentorId" TEXT NOT NULL,
    "hours" REAL NOT NULL,
    "deadline" DATETIME NOT NULL,
    "deadlineStage" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "HourAllocation_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "StudentProfile" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "HourAllocation_mentorId_fkey" FOREIGN KEY ("mentorId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_HourAllocation" ("id", "studentId", "mentorId", "hours", "deadline", "deadlineStage", "createdAt", "updatedAt")
SELECT "id", "studentId", "mentorId", "hours", COALESCE("deadline", '2099-12-31T00:00:00.000+00:00'), "deadlineStage", "createdAt", "updatedAt" FROM "HourAllocation";
DROP TABLE "HourAllocation";
ALTER TABLE "new_HourAllocation" RENAME TO "HourAllocation";
CREATE UNIQUE INDEX "HourAllocation_studentId_mentorId_key" ON "HourAllocation"("studentId", "mentorId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
