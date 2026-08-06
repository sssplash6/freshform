-- Three changes to how a meeting and a task are recorded.
--
-- 1. A session had two free-text fields, "task" and "note", which asked the
--    mentor the same question twice. They collapse into one note; whatever was
--    in both is joined so nothing written is lost.
-- 2. "late" records that the student turned up late. The hours are whatever the
--    mentor logs, as always — this only says what kind of meeting it was.
-- 3. A task's date is called what the team calls it: a deadline. It stays free
--    text (the tracking sheet holds both "Aug 7" and "March-May"), unlike
--    HourAllocation.deadline, which is a hard date that forfeits hours.

-- 1. task + note → note
UPDATE "Session"
SET "note" = TRIM(
      COALESCE("task", '') ||
      CASE
        WHEN COALESCE("task", '') <> '' AND COALESCE("note", '') <> '' THEN ' — '
        ELSE ''
      END ||
      COALESCE("note", '')
    )
WHERE COALESCE("task", '') <> '';

ALTER TABLE "Session" DROP COLUMN "task";

-- 2. AlterTable
ALTER TABLE "Session" ADD COLUMN "late" BOOLEAN NOT NULL DEFAULT false;

-- 3. AlterTable
ALTER TABLE "Assignment" RENAME COLUMN "timeline" TO "deadline";
