import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

/**
 * Runs pending migrations against the given connection string, then closes
 * the connection it opened. Used at production boot (src/instrumentation.ts)
 * and by the integration test harness (src/test/db.ts) — never imported by
 * a service, which reads and writes through the pooled client in
 * db/client.ts instead.
 */
export async function runMigrations(connectionString: string): Promise<void> {
  const migrationClient = postgres(connectionString, { max: 1 });
  try {
    await migrate(drizzle(migrationClient), { migrationsFolder: "src/server/db/migrations" });
  } finally {
    await migrationClient.end();
  }
}
