-- The plan half of the student ledger: what a consultant is doing for a
-- student, its hour budget, its timeline and how far along it is. Separate
-- from HourAllocation because one consultant commonly has several assignments
-- for the same student, which that table's (studentId, mentorId) unique index
-- forbids.
-- CreateTable
CREATE TABLE "Assignment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "studentId" TEXT NOT NULL,
    "mentorId" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "hourLimit" REAL,
    "timeline" TEXT,
    "progress" TEXT NOT NULL DEFAULT 'NOT_STARTED',
    "position" INTEGER NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Assignment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "StudentProfile" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Assignment_mentorId_fkey" FOREIGN KEY ("mentorId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Assignment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Assignment_studentId_position_idx" ON "Assignment"("studentId", "position");
