import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

// Arbitrary constant, scoped to this app, used only as a pg_advisory_lock
// key — see the comment below.
const MIGRATION_LOCK_KEY = 727_633;

/**
 * Runs pending migrations against the given connection string, then closes
 * the connection it opened. Used at production boot (src/instrumentation.ts)
 * and by the integration test harness (src/test/db.ts) — never imported by
 * a service, which reads and writes through the pooled client in
 * db/client.ts instead.
 *
 * Every test file's setupTestDb() calls this in its own beforeAll, and
 * Vitest runs test files concurrently by default, so multiple callers can
 * race here against the same database. `CREATE SCHEMA IF NOT EXISTS
 * "drizzle"` (drizzle-orm's own migration bookkeeping) is not safe under
 * true concurrency — confirmed empirically: two callers both pass the
 * existence check before either commits, and the second's CREATE fails
 * with a duplicate key on pg_namespace. A session-scoped advisory lock
 * serializes just the migration step; everything after it (the actual
 * tests) still runs in parallel as normal.
 */
export async function runMigrations(connectionString: string): Promise<void> {
  const migrationClient = postgres(connectionString, { max: 1 });
  try {
    await migrationClient`SELECT pg_advisory_lock(${MIGRATION_LOCK_KEY})`;
    try {
      await migrate(drizzle(migrationClient), { migrationsFolder: "src/server/db/migrations" });
    } finally {
      await migrationClient`SELECT pg_advisory_unlock(${MIGRATION_LOCK_KEY})`;
    }
  } finally {
    await migrationClient.end();
  }
}
