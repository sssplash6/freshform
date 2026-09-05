-- Admin access becomes a GRANT, not a role.
--
-- Until now "admin" was one global thing: `User.role = 'ADMIN'` saw every
-- program, every student and every figure in the app. The owner asked for
-- per-program admins, so scope moves out of the role column and into rows:
-- one ProgramStaff row per (person, program) they may administer, plus a
-- single `platformAdmin` flag for the people who run the whole platform.
--
-- Additive only. No table is rebuilt, so nothing can be dropped by accident:
-- three ADD/CREATEs and three UPDATE/INSERTs that carry the current state
-- forward.
--
-- The backfill is deliberately generous — every existing ADMIN is granted
-- every existing program — because this migration must not take access away
-- from anyone on the day it runs. Narrowing happens afterwards, by hand, on
-- /settings/platform. `tech@freshman.academy` is the bootstrap platform admin
-- and is the one account that can make the others.
--
-- `User.programId` is emptied here: it was DEPT_LEADER / SALES scope, and
-- those two roles are seeded by nobody after this commit. The column itself
-- survives until M8 (Prisma refuses to drop a column under an FK without a
-- table rebuild, and a rebuild is not worth doing twice).

-- ProgramStaff: one row = one person may administer one program.
-- Ids are hex rather than cuid because SQLite mints these; every row written
-- by the app afterwards gets a cuid from Prisma. Both are opaque TEXT.
CREATE TABLE "ProgramStaff" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProgramStaff_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ProgramStaff_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ProgramStaff_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- One grant per person per program. A change of level is an UPDATE of role,
-- never a second row.
CREATE UNIQUE INDEX "ProgramStaff_userId_programId_key" ON "ProgramStaff"("userId", "programId");

-- Runs the platform itself: sees every program, and is the only writer of
-- ProgramStaff rows.
ALTER TABLE "User" ADD COLUMN "platformAdmin" BOOLEAN NOT NULL DEFAULT false;

-- Carry today's access forward: every admin keeps every program.
INSERT INTO "ProgramStaff" ("id", "userId", "programId", "role", "createdById")
SELECT lower(hex(randomblob(16))), u."id", p."id", 'ADMIN', NULL
FROM "User" u
CROSS JOIN "Program" p
WHERE u."role" = 'ADMIN';

-- The bootstrap account, and the only one the seed will ever touch again.
UPDATE "User" SET "platformAdmin" = true WHERE "email" = 'tech@freshman.academy';

-- DEPT_LEADER / SALES scope is now a grant like any other.
UPDATE "User" SET "programId" = NULL;
