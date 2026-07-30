-- Notifications gain a destination and an actor. Without href a reader learns
-- that something happened and then has to go hunt for what it happened to;
-- without actorId a list of events can't be scanned by who did them.
--
-- Rebuild rather than ALTER: SQLite cannot add a foreign-key column in place.
-- Existing rows keep their message and read state, with both new fields null.
PRAGMA foreign_keys=OFF;

CREATE TABLE "new_Notification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "href" TEXT,
    "actorId" TEXT,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Notification_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

INSERT INTO "new_Notification" ("id","userId","type","message","href","actorId","read","createdAt")
SELECT "id","userId","type","message",NULL,NULL,"read","createdAt" FROM "Notification";

DROP TABLE "Notification";
ALTER TABLE "new_Notification" RENAME TO "Notification";

CREATE INDEX "Notification_userId_read_idx" ON "Notification"("userId", "read");

PRAGMA foreign_keys=ON;
