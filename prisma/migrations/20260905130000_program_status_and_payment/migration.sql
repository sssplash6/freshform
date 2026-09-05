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

-- Which programs bill per student, decided from the DATA first and the name
-- second.
--
-- The name is not trustworthy enough to be the only test on a live database:
-- this migration runs against whatever the deployment actually holds, and a
-- program renamed, or carrying a stray space, would silently come out with the
-- money fields switched OFF — which is the exact failure this column exists to
-- prevent, reintroduced by the migration that adds it.
--
-- So: any program that already has an allocation with an amount recorded bills
-- per student. That is provable rather than assumed. The name match stays as a
-- fallback for a program that bills but has not taken a payment yet, and it is
-- trimmed and case-folded so the obvious drifts still hit.
UPDATE "Program" SET "tracksPayment" = 1 WHERE "id" IN (
  SELECT DISTINCT sp."programId"
  FROM "HourAllocation" ha
  JOIN "StudentProfile" sp ON sp."id" = ha."studentId"
  WHERE ha."amountPaid" IS NOT NULL
);

UPDATE "Program" SET "tracksPayment" = 1
WHERE lower(trim("name")) = lower('Master''s Program');
