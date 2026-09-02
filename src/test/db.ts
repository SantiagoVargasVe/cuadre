import { is, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import { getTableConfig, PgTable } from "drizzle-orm/pg-core";
import postgres from "postgres";
import { afterAll, afterEach, beforeAll } from "vitest";
import { runMigrations } from "../server/db/migrate";
import * as schema from "../server/db/schema";

const DATABASE_URL_TEST = process.env.DATABASE_URL_TEST;

/** Whether an integration test file has a real database to run against. */
export const hasTestDatabase = Boolean(DATABASE_URL_TEST);

// A silent skip in CI is indistinguishable from a pass — fail loudly at
// import time instead, before describe.skipIf ever gets a chance to skip
// anything. Locally, with DATABASE_URL_TEST unset, this is a no-op and
// hasTestDatabase drives the skip.
if (!hasTestDatabase && process.env.CI) {
  throw new Error(
    "DATABASE_URL_TEST is unset in CI. Integration tests must run against a real database in " +
      "CI — see docs/context/testing.md.",
  );
}

let client: postgres.Sql | undefined;
let db: ReturnType<typeof drizzle<typeof schema>> | undefined;

/**
 * Reference data seeded by migration, not a per-test fixture. Truncating
 * it between tests would wipe rows nothing re-inserts, breaking every
 * later test in the file that depends on the FK — confirmed empirically
 * when T020 added the first such FK (`groups.default_currency`).
 *
 * - `currencies` — seeded by migration 0002.
 * - `expense_categories` — seeded by migration 0009 (T090);
 *   `expenses.category_key` references it.
 */
const SEED_TABLES = new Set(["currencies", "expense_categories"]);

/**
 * Call at the top of an integration test file's `describe.skipIf(!hasTestDatabase)`
 * block:
 *
 * ```ts
 * describe.skipIf(!hasTestDatabase)("thing that needs a real db", () => {
 *   setupTestDb();
 *   it("...", async () => {
 *     const db = getTestDb();
 *   });
 * });
 * ```
 *
 * Connects once per test file and runs migrations once, then truncates
 * every table between individual tests rather than recreating the
 * database — cheap, and leaves sequences and the schema alone.
 */
export function setupTestDb(): void {
  beforeAll(async () => {
    if (!DATABASE_URL_TEST) return;
    await runMigrations(DATABASE_URL_TEST);
    client = postgres(DATABASE_URL_TEST, { max: 1 });
    db = drizzle(client, { schema });
  });

  afterEach(async () => {
    if (!db) return;
    const tableNames = Object.values(schema as Record<string, unknown>)
      .filter((value) => is(value, PgTable))
      .map((table) => getTableConfig(table as PgTable).name)
      .filter((name) => !SEED_TABLES.has(name));
    if (tableNames.length === 0) return;

    const quoted = tableNames.map((name) => `"${name}"`).join(", ");
    await db.execute(sql.raw(`TRUNCATE TABLE ${quoted} RESTART IDENTITY CASCADE`));
  });

  afterAll(async () => {
    await client?.end();
    client = undefined;
    db = undefined;
  });
}

/** The connected test database. Throws if called outside setupTestDb()'s hooks. */
export function getTestDb(): ReturnType<typeof drizzle<typeof schema>> {
  if (!db) {
    throw new Error("Test database not initialized — call setupTestDb() inside the describe block.");
  }
  return db;
}
