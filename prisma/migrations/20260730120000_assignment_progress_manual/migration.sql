-- Goal progress is now derived from hours logged against the goal, so this flag
-- records the exception: an admin who states progress by hand pins it, because
-- work finished under budget is done even though the hours say otherwise.
--
-- Defaults to false, i.e. existing goals hand back to automatic. Their progress
-- values stay as they are until the next session re-derives them.
-- AlterTable
ALTER TABLE "Assignment" ADD COLUMN "progressManual" BOOLEAN NOT NULL DEFAULT false;
