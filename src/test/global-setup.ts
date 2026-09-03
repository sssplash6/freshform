import { execFileSync } from "node:child_process";
import { rmSync } from "node:fs";

/**
 * Build prisma/test.db from the migrations once per run.
 *
 * Deleted first, so the schema under test is always the migration history and
 * never whatever a previous run left behind — the same guarantee `prisma
 * migrate deploy` gives on Render, applied to the test database.
 */
export default function setup() {
  for (const suffix of ["", "-journal", "-wal", "-shm"]) {
    rmSync(`prisma/test.db${suffix}`, { force: true });
  }
  execFileSync("npx", ["prisma", "migrate", "deploy"], {
    env: { ...process.env, DATABASE_URL: "file:./prisma/test.db" },
    stdio: "pipe",
  });
}
