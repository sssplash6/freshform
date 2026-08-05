-- AlterTable
ALTER TABLE "User" ADD COLUMN "avatarUpdatedAt" DATETIME;

-- CreateTable
CREATE TABLE "AvatarImage" (
    "userId" TEXT NOT NULL PRIMARY KEY,
    "bytes" BLOB NOT NULL,
    "mimeType" TEXT NOT NULL,
    CONSTRAINT "AvatarImage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
