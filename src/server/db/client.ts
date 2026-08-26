import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { config } from "../config";
import * as schema from "./schema";

/**
 * The one pooled connection for this process. Only src/server/services/
 * imports this — routes call into services, services call into db.
 */
const client = postgres(config.DATABASE_URL);

export const db = drizzle(client, { schema });

/** Type-only — safe to import from code that must stay `server-only`-free (e.g. scripts/). */
export type Db = typeof db;

export type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Wraps a multi-step write in one transaction. Services use this instead of
 * calling db.transaction directly, so db/client.ts stays the only place
 * that knows how a transaction is opened.
 */
export function withTransaction<T>(fn: (tx: Transaction) => Promise<T>): Promise<T> {
  return db.transaction(fn);
}
