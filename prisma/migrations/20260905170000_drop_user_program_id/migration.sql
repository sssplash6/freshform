-- The last of the old permission model leaves the schema.
--
-- `User.programId` was one program per person, set by a seed: it was what
-- DEPT_LEADER and SALES scope meant, and it was the reason those two roles had
-- their own route trees. It could not say "these two programs and not the
-- third", which is exactly what the owner asked for — so it was replaced by
-- ProgramStaff rows, emptied in that migration, and nothing has read it since.
--
-- This is the ONLY table rebuild in the reorganisation, and it is last on
-- purpose. SQLite will not DROP a column that carries a foreign key, so the
-- table has to be recreated — every column named explicitly, the rows copied,
-- the indexes rebuilt — and a rebuild is the one shape of migration that can
-- silently lose data. Doing it once, at the end, against a column nothing has
-- referenced for a release, is the cheapest way to be sure.
--
-- Written by hand rather than scaffolded, per the repo convention (see the
-- header of 20260829110000_durations_in_minutes): Prisma's generated
-- redefinition drops the old table before copying out of it in some orders.

PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "role" TEXT NOT NULL,
    "isMentor" BOOLEAN NOT NULL DEFAULT false,
    "platformAdmin" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "avatarUpdatedAt" DATETIME,
    "weeklyDigest" BOOLEAN NOT NULL DEFAULT true,
    "digestSentAt" DATETIME
);

INSERT INTO "new_User" (
    "id", "email", "name", "role", "isMentor", "platformAdmin", "status",
    "createdAt", "updatedAt", "avatarUpdatedAt", "weeklyDigest", "digestSentAt"
)
SELECT
    "id", "email", "name", "role", "isMentor", "platformAdmin", "status",
    "createdAt", "updatedAt", "avatarUpdatedAt", "weeklyDigest", "digestSentAt"
FROM "User";

DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
