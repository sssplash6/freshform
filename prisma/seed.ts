// Idempotent seed: inserts the three programs, their starter cohorts, and the
// bootstrap platform admin from config/app-config.ts. Safe to re-run after
// editing the config (uses upserts; never deletes).
//
// It deliberately writes NO program-access grants. Admin access lives in
// ProgramStaff, which only /settings/platform writes — see the note there.
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

  // The bootstrap admin. Everyone else who administers anything is a
  // ProgramStaff row, written from /settings/platform and NEVER from here:
  // this file runs on every boot (render.yaml), so a grant seeded from config
  // would come back the next time the app restarted, undoing a removal the
  // owner had just made.
  for (const staff of STAFF_SEED) {
    const email = staff.email.toLowerCase();
    await prisma.user.upsert({
      where: { email },
      update: {
        role: staff.role,
        isMentor: staff.isMentor ?? false,
        platformAdmin: staff.platformAdmin,
      },
      create: {
        email,
        name: staff.name,
        role: staff.role,
        status: "ACTIVE",
        isMentor: staff.isMentor ?? false,
        platformAdmin: staff.platformAdmin,
      },
    });
    console.log(`Platform admin ${email}${staff.isMentor ? " + mentor" : ""}`);
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
