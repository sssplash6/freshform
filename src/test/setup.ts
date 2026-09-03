import { beforeEach } from "vitest";

import { resetDb } from "@/test/db";

// Every test starts from an empty database, so no test can depend on another's
// rows and a failure never cascades.
beforeEach(async () => {
  await resetDb();
});
