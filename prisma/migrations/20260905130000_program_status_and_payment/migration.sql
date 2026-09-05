-- A program gains a lifecycle, and money stops being a string match.
--
-- `tracksPayment` is the one that mattered. Whether an allocation records what
-- was paid was decided at FOUR call sites by comparing a program's NAME to a
-- constant in config — so renaming the Master's Program, which the settings
-- page offers to do, would have silently switched the money fields off across
-- the app and nothing would have said so. It is a column on the program now.
--
-- `status` and `archivedAt` are the other half of the same page: a program
-- that has finished should stop appearing in every picker without being
-- DELETED, which is refused anyway while it still holds students.
--
-- Three ADD COLUMNs with constant defaults. No CURRENT_TIMESTAMP default and
-- no `position`: SQLite forbids the first as an ADD COLUMN default, and
-- programs order by name.

ALTER TABLE "Program" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE "Program" ADD COLUMN "archivedAt" DATETIME;
ALTER TABLE "Program" ADD COLUMN "tracksPayment" BOOLEAN NOT NULL DEFAULT false;

-- The one program that bills per student today, named once, here, instead of
-- at four places in the application code forever.
UPDATE "Program" SET "tracksPayment" = 1 WHERE "name" = 'Master''s Program';
