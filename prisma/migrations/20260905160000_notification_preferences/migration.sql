-- What each person wants to hear about, and where.
--
-- There was one switch for one email: `User.weeklyDigest`. Everything else
-- arrived in the feed whether you cared or not, which is why the feed became
-- something people scroll past — a notification that always arrives is one
-- nobody reads.
--
-- One row per person per category, holding two answers: in the app, and by
-- email. Six categories plus WEEKLY_SUMMARY, which is a subscription rather
-- than a kind of notice and is why the table is keyed on a string rather than
-- reusing the notification category enum.
--
-- Absence is the default, deliberately: no row means "in-app yes, email no",
-- which is what everybody has today. Only a person who has expressed a
-- preference gets a row, so the table stays the size of the decisions actually
-- made rather than users × categories.
--
-- `User.weeklyDigest` is NOT dropped. The unsubscribe link in every email
-- footer authorizes on an HMAC and writes that column, and those links are
-- already in inboxes; it goes one release after this one.

CREATE TABLE "NotificationPreference" (
    "userId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "inApp" BOOLEAN NOT NULL DEFAULT true,
    "email" BOOLEAN NOT NULL DEFAULT false,
    PRIMARY KEY ("userId", "category"),
    CONSTRAINT "NotificationPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Carry the one switch that already existed. Everybody keeps exactly the mail
-- they were getting this morning.
INSERT INTO "NotificationPreference" ("userId", "category", "inApp", "email")
SELECT "id", 'WEEKLY_SUMMARY', true, "weeklyDigest" FROM "User";
