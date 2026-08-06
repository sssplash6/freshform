-- A task's own note: what a person needs to say about it that its progress state
-- can't carry ("missed an hour, not excused"). The Master's tracking sheet wrote
-- this alongside the state in its Progress column.
-- AlterTable
ALTER TABLE "Assignment" ADD COLUMN "note" TEXT;
