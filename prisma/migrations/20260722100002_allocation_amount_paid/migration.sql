-- Amount paid: for Master's Program allocations the admin records how much the
-- student paid for the hours. Null for all other programs.
-- AlterTable
ALTER TABLE "HourAllocation" ADD COLUMN "amountPaid" REAL;
