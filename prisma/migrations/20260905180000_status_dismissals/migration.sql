-- Silencing one attention row, for good.
--
-- Attention rows are DERIVED — `lib/status.ts` recomputes them from the ledger
-- on every render, so there is nothing to mark as read. Most of them clear
-- themselves the moment the thing they describe is dealt with, which is the
-- point. A few do not: "Not in any program" for a mentor nobody intends to
-- place, an imported student who will never sign in. Those sit on the inbox
-- forever, and a list that always has the same row on it stops being read.
--
-- So a dismissal is a row: this reader, this kind of notice, about this
-- subject. Scoped to the READER, not global — one admin deciding they have
-- seen enough of a row must not hide it from everybody else, and the state is
-- an opinion about a list, not a fact about the school.
--
-- No expiry column. "Snooze until Tuesday" is a second feature with a second
-- set of questions; this is the one people asked for, and a row can be
-- restored by deleting it.

CREATE TABLE "StatusDismissal" (
    "userId"    TEXT NOT NULL,
    "type"      TEXT NOT NULL,
    -- The thing the row is about: a student, a mentor, a program, a task. "" for
    -- a row about nothing in particular, which is what a rolled-up row is.
    "subjectId" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY ("userId", "type", "subjectId"),
    CONSTRAINT "StatusDismissal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
