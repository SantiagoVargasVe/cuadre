import { describe, expect, it } from "vitest";
import { hasTestDatabase, setupTestDb, getTestDb } from "../../test/db";
import { schemaSmokeTest } from "./schema";

/**
 * Proves the whole harness loop end to end: migrations apply against
 * DATABASE_URL_TEST, the pooled test client can read and write, and
 * afterEach truncates between tests rather than leaking rows.
 */
describe.skipIf(!hasTestDatabase)("db harness smoke test", () => {
  setupTestDb();

  it("runs migrations and reads back what it writes", async () => {
    const db = getTestDb();

    await db.insert(schemaSmokeTest).values({});
    const rows = await db.select().from(schemaSmokeTest);

    expect(rows).toHaveLength(1);
  });

  it("starts empty because afterEach truncated the previous test's row", async () => {
    const db = getTestDb();

    const rows = await db.select().from(schemaSmokeTest);

    expect(rows).toHaveLength(0);
  });
});
