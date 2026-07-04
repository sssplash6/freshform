// Idempotent seed: inserts the three programs, starter cohorts, and the
// staff preset list from config/app-config.ts. Safe to re-run after editing
// the config (uses upserts; never deletes).
//
// Run with: npx prisma db seed

import "dotenv/config";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../src/generated/prisma/client";
import { PROGRAMS, STAFF_SEED } from "../config/app-config";

const adapter = new PrismaBetterSqlite3({ url: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  // Programs and their starter cohorts
  for (const { name, cohorts } of PROGRAMS) {
    const program = await prisma.program.upsert({
      where: { name },
      update: {},
      create: { name },
    });
    for (const cohortName of cohorts) {
      await prisma.cohort.upsert({
        where: { programId_name: { programId: program.id, name: cohortName } },
        update: {},
        create: { programId: program.id, name: cohortName },
      });
    }
    console.log(`Program "${name}" (${cohorts.length} cohort(s))`);
  }

  // Staff preset list
  for (const staff of STAFF_SEED) {
    if (staff.role !== "ADMIN" && !staff.program) {
      throw new Error(
        `Staff entry ${staff.email}: role ${staff.role} requires a program.`
      );
    }
    const program = staff.program
      ? await prisma.program.findUniqueOrThrow({ where: { name: staff.program } })
      : null;

    const email = staff.email.toLowerCase();
    await prisma.user.upsert({
      where: { email },
      update: {
        role: staff.role,
        programId: program?.id ?? null,
      },
      create: {
        email,
        name: staff.name,
        role: staff.role,
        status: "ACTIVE",
        programId: program?.id ?? null,
      },
    });
    console.log(`Staff ${email} → ${staff.role}${staff.program ? ` (${staff.program})` : ""}`);
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
    console.log("Seeding finished.");
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
