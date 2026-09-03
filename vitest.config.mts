import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

/**
 * Unit tests for the pure and the DB-backed logic in src/lib — above all the
 * hours engine, whose figures the UI reorganisation must not move.
 *
 * Tests run against their OWN SQLite file (prisma/test.db, created by
 * src/test/global-setup.ts and wiped between tests), never prisma/dev.db:
 * src/lib/prisma.ts reads DATABASE_URL when its module first loads, so the
 * value has to be in the environment before any import runs — which is why it
 * is set here rather than in a setup file.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    globalSetup: ["src/test/global-setup.ts"],
    setupFiles: ["src/test/setup.ts"],
    env: { DATABASE_URL: "file:./prisma/test.db" },
    // One process for the whole run: every file shares one SQLite file, and
    // SQLite takes one writer. Parallel files would deadlock on the wipe.
    fileParallelism: false,
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // `server-only`'s default export throws on import; Next resolves it to an
      // empty module under the `react-server` condition, and so do we, so a
      // test may import a module that declares itself server-only.
      "server-only": fileURLToPath(
        new URL("./node_modules/server-only/empty.js", import.meta.url)
      ),
    },
  },
});
