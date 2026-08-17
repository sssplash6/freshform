-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Assignment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "studentId" TEXT NOT NULL,
    "mentorId" TEXT,
    "purpose" TEXT NOT NULL,
    "hourLimit" REAL,
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
INSERT INTO "new_Assignment" ("createdAt", "createdById", "deadline", "hourLimit", "id", "mentorId", "note", "position", "progress", "progressManual", "purpose", "studentId", "updatedAt") SELECT "createdAt", "createdById", "deadline", "hourLimit", "id", "mentorId", "note", "position", "progress", "progressManual", "purpose", "studentId", "updatedAt" FROM "Assignment";
DROP TABLE "Assignment";
ALTER TABLE "new_Assignment" RENAME TO "Assignment";
CREATE INDEX "Assignment_studentId_position_idx" ON "Assignment"("studentId", "position");
CREATE TABLE "new_HourAllocation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "studentId" TEXT NOT NULL,
    "mentorId" TEXT,
    "hours" REAL NOT NULL,
    "amountPaid" REAL,
    "deadline" DATETIME NOT NULL,
    "deadlineStage" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "HourAllocation_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "StudentProfile" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "HourAllocation_mentorId_fkey" FOREIGN KEY ("mentorId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_HourAllocation" ("amountPaid", "createdAt", "deadline", "deadlineStage", "hours", "id", "mentorId", "studentId", "updatedAt") SELECT "amountPaid", "createdAt", "deadline", "deadlineStage", "hours", "id", "mentorId", "studentId", "updatedAt" FROM "HourAllocation";
DROP TABLE "HourAllocation";
ALTER TABLE "new_HourAllocation" RENAME TO "HourAllocation";
CREATE UNIQUE INDEX "HourAllocation_studentId_mentorId_key" ON "HourAllocation"("studentId", "mentorId");
CREATE TABLE "new_HourAllotmentChange" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "studentId" TEXT NOT NULL,
    "mentorId" TEXT,
    "changedById" TEXT NOT NULL,
    "oldHours" REAL NOT NULL,
    "newHours" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "HourAllotmentChange_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "StudentProfile" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "HourAllotmentChange_mentorId_fkey" FOREIGN KEY ("mentorId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "HourAllotmentChange_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_HourAllotmentChange" ("changedById", "createdAt", "id", "mentorId", "newHours", "oldHours", "studentId") SELECT "changedById", "createdAt", "id", "mentorId", "newHours", "oldHours", "studentId" FROM "HourAllotmentChange";
DROP TABLE "HourAllotmentChange";
ALTER TABLE "new_HourAllotmentChange" RENAME TO "HourAllotmentChange";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
