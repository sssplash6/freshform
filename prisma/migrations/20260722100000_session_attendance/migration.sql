-- Session attendance: mentors mark whether the student was present. A no-show
-- (attended = false) still draws the hours down but is tallied separately as
-- "missed" hours. Existing sessions predate the flag and are treated as
-- attended.
-- AlterTable
ALTER TABLE "Session" ADD COLUMN "attended" BOOLEAN NOT NULL DEFAULT true;
