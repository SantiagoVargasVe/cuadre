import { pgTable, serial, timestamp } from "drizzle-orm/pg-core";

/**
 * Exists solely to prove the migration + integration-test-harness pipeline
 * (T003) end to end before any real table exists. Real application tables
 * start arriving with T010 (`users`, `invite_codes`). No `server-only` here
 * — drizzle-kit loads this file directly in a plain Node process, outside
 * Next's react-server module resolution, and the guard would throw.
 */
export const schemaSmokeTest = pgTable("schema_smoke_test", {
  id: serial("id").primaryKey(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
