-- A task's due date splits in two: what somebody wrote, and what a clock can read.
--
-- `Assignment.deadline` is free text and always has been, deliberately: the
-- tracking spreadsheet holds both "Aug 7" and "March–May", and the second is
-- not a date. So the column stayed a note, and the cost was that no task could
-- ever be OVERDUE — `TASK_OVERDUE` has been written and dormant since the
-- status model landed, because guessing at "March–May" is how a task gets
-- flagged overdue for a range it is still inside.
--
-- Both halves now exist. `dueNote` keeps every string ever typed, unchanged and
-- still shown. `dueOn` is null until somebody gives a real date, and it is the
-- ONLY thing that decides overdue.
--
-- Additive, plus a rename that carries the data with it. RENAME COLUMN is used
-- rather than a table rebuild for the same reason as
-- `20260806170000_session_notes_late_task_deadline`: a rebuild here would drop
-- the notes on every planned task in the school.

ALTER TABLE "Assignment" RENAME COLUMN "deadline" TO "dueNote";
ALTER TABLE "Assignment" ADD COLUMN "dueOn" DATETIME;
