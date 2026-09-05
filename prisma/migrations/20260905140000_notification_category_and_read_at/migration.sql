-- A notification learns what KIND it is, and when it was read.
--
-- `category` is what makes the feed filterable and, in the commit after this
-- one, what a per-category email preference switches on. It is derived from
-- `type` here rather than looked up in application code every time a row is
-- read, because there are seventeen types and five categories, and a mapping
-- that lives in a `switch` is a mapping the database cannot group by.
--
-- `readAt` replaces nothing: `read` stays, because the unsubscribe links and
-- the unread badge both use it. What was missing is WHEN — "you read this on
-- Tuesday" is the difference between a feed and a pile. Existing read rows are
-- backfilled to their own createdAt, which is the only honest guess available
-- and is never later than the truth.

ALTER TABLE "Notification" ADD COLUMN "category" TEXT NOT NULL DEFAULT 'ACCOUNTS';
ALTER TABLE "Notification" ADD COLUMN "readAt" DATETIME;

UPDATE "Notification" SET "category" = CASE
  WHEN "type" = 'HOURS_GRANTED' THEN 'HOURS'
  WHEN "type" LIKE 'SESSION_%' THEN 'SESSIONS'
  WHEN "type" LIKE 'INTERVIEW_%' THEN 'MEETINGS'
  WHEN "type" LIKE 'GOAL_%' THEN 'TASKS'
  WHEN "type" = 'HOURS_DEADLINE' THEN 'DEADLINES'
  ELSE 'ACCOUNTS'
END;

UPDATE "Notification" SET "readAt" = "createdAt" WHERE "read" = 1;
