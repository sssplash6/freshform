-- Dual-role admins: an ADMIN with isMentor = true can also act as a mentor
-- (assigned to programs, logs sessions) and toggle between the two dashboards.
-- AlterTable
ALTER TABLE "User" ADD COLUMN "isMentor" BOOLEAN NOT NULL DEFAULT false;
