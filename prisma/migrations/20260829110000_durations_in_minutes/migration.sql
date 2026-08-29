-- Durations become whole MINUTES.
--
-- Every duration in the ledger was a decimal-hours REAL: Session.hours,
-- HourAllocation.hours, Assignment.hourLimit and both sides of the allotment
-- audit. The team speaks in minutes, and the app now does too.
--
-- The conversion is round(hours * 60), and it is lossless in the direction that
-- matters: these values were minutes in the original tracking spreadsheet,
-- divided by 60 and stored to two decimals, so 1.08 -> 65, 2.83 -> 170,
-- 0.37 -> 22. Rounding recovers the whole minute each one was cut from (worst
-- observed drift: 0.2 of a minute). CAST after ROUND so SQLite stores an
-- INTEGER, not a REAL that merely looks whole.
--
-- Written by hand rather than scaffolded: Prisma's generated redefinition drops
-- the old column and leaves the new one empty, which would throw the whole
-- ledger away. The INSERT ... SELECT below is the entire point of the file.

PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

-- Assignment.hourLimit -> minuteLimit (nullable: not every task is budgeted)
CREATE TABLE "new_Assignment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "studentId" TEXT NOT NULL,
    "mentorId" TEXT,
    "purpose" TEXT NOT NULL,
    "minuteLimit" INTEGER,
    "deadline" TEXT,
    "note" TEXT,
    "progress" TEXT NOT NULL DEFAULT 'NOT_STARTED',
    "progressManual" BOOLEAN NOT NULL DEFAULT false,
    "position" INTEGER NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Assignment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "StudentProfile" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Assignment_mentorId_fkey" FOREIGN KEY ("mentorId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Assignment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Assignment" ("id", "studentId", "mentorId", "purpose", "minuteLimit", "deadline", "note", "progress", "progressManual", "position", "createdById", "createdAt", "updatedAt")
SELECT "id", "studentId", "mentorId", "purpose",
       CASE WHEN "hourLimit" IS NULL THEN NULL ELSE CAST(ROUND("hourLimit" * 60) AS INTEGER) END,
       "deadline", "note", "progress", "progressManual", "position", "createdById", "createdAt", "updatedAt"
FROM "Assignment";
DROP TABLE "Assignment";
ALTER TABLE "new_Assignment" RENAME TO "Assignment";
CREATE INDEX "Assignment_studentId_position_idx" ON "Assignment"("studentId", "position");

-- HourAllocation.hours -> minutes (amountPaid stays money, untouched)
CREATE TABLE "new_HourAllocation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "studentId" TEXT NOT NULL,
    "mentorId" TEXT,
    "minutes" INTEGER NOT NULL,
    "amountPaid" REAL,
    "deadline" DATETIME NOT NULL,
    "deadlineStage" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "HourAllocation_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "StudentProfile" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "HourAllocation_mentorId_fkey" FOREIGN KEY ("mentorId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_HourAllocation" ("id", "studentId", "mentorId", "minutes", "amountPaid", "deadline", "deadlineStage", "createdAt", "updatedAt")
SELECT "id", "studentId", "mentorId", CAST(ROUND("hours" * 60) AS INTEGER), "amountPaid", "deadline", "deadlineStage", "createdAt", "updatedAt"
FROM "HourAllocation";
DROP TABLE "HourAllocation";
ALTER TABLE "new_HourAllocation" RENAME TO "HourAllocation";
CREATE UNIQUE INDEX "HourAllocation_studentId_mentorId_key" ON "HourAllocation"("studentId", "mentorId");

-- Session.hours -> minutes
CREATE TABLE "new_Session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "studentId" TEXT NOT NULL,
    "mentorId" TEXT NOT NULL,
    "assignmentId" TEXT,
    "minutes" INTEGER NOT NULL,
    "date" DATETIME NOT NULL,
    "attended" BOOLEAN NOT NULL DEFAULT true,
    "late" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "withinPlan" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Session_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "StudentProfile" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Session_mentorId_fkey" FOREIGN KEY ("mentorId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Session_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "Assignment" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Session" ("id", "studentId", "mentorId", "assignmentId", "minutes", "date", "attended", "late", "note", "status", "withinPlan", "createdAt", "updatedAt")
SELECT "id", "studentId", "mentorId", "assignmentId", CAST(ROUND("hours" * 60) AS INTEGER), "date", "attended", "late", "note", "status", "withinPlan", "createdAt", "updatedAt"
FROM "Session";
DROP TABLE "Session";
ALTER TABLE "new_Session" RENAME TO "Session";
CREATE INDEX "Session_assignmentId_idx" ON "Session"("assignmentId");

-- HourAllotmentChange: both sides of every audited change
CREATE TABLE "new_HourAllotmentChange" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "studentId" TEXT NOT NULL,
    "mentorId" TEXT,
    "changedById" TEXT NOT NULL,
    "oldMinutes" INTEGER NOT NULL,
    "newMinutes" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "HourAllotmentChange_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "StudentProfile" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "HourAllotmentChange_mentorId_fkey" FOREIGN KEY ("mentorId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "HourAllotmentChange_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_HourAllotmentChange" ("id", "studentId", "mentorId", "changedById", "oldMinutes", "newMinutes", "createdAt")
SELECT "id", "studentId", "mentorId", "changedById", CAST(ROUND("oldHours" * 60) AS INTEGER), CAST(ROUND("newHours" * 60) AS INTEGER), "createdAt"
FROM "HourAllotmentChange";
DROP TABLE "HourAllotmentChange";
ALTER TABLE "new_HourAllotmentChange" RENAME TO "HourAllotmentChange";

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
