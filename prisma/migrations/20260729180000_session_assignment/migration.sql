-- Which assigned goal a logged meeting went toward. Required in the log-session
-- form from now on, but nullable here: sessions logged before goals existed keep
-- their history rather than being backfilled with a guess.
--
-- SQLite cannot add a column with a foreign key via ALTER TABLE, so the table is
-- rebuilt: create, copy, swap. Session rows are the hour ledger, so the copy is
-- explicit about every column rather than relying on ordering.
PRAGMA foreign_keys=OFF;

CREATE TABLE "new_Session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "studentId" TEXT NOT NULL,
    "mentorId" TEXT NOT NULL,
    "assignmentId" TEXT,
    "hours" REAL NOT NULL,
    "date" DATETIME NOT NULL,
    "attended" BOOLEAN NOT NULL DEFAULT true,
    "task" TEXT,
    "note" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Session_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "StudentProfile" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Session_mentorId_fkey" FOREIGN KEY ("mentorId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Session_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "Assignment" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

INSERT INTO "new_Session" ("id","studentId","mentorId","assignmentId","hours","date","attended","task","note","status","createdAt","updatedAt")
SELECT "id","studentId","mentorId",NULL,"hours","date","attended","task","note","status","createdAt","updatedAt" FROM "Session";

DROP TABLE "Session";
ALTER TABLE "new_Session" RENAME TO "Session";

CREATE INDEX "Session_assignmentId_idx" ON "Session"("assignmentId");

PRAGMA foreign_keys=ON;
