import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { config } from "../config";
import * as schema from "./schema";

type DrizzleDb = ReturnType<typeof drizzle<typeof schema>>;

/**
 * Cached on `globalThis` so Next's dev-mode HMR — which re-evaluates modules
 * on every save — doesn't open a fresh pool per edit until Postgres refuses
 * new connections.
 */
const globalForDb = globalThis as unknown as {
  __cuadreSql?: ReturnType<typeof postgres>;
  __cuadreDb?: DrizzleDb;
};

/**
 * The one pooled connection for this process, created on first use.
 *
 * Lazy for the same reason `config` is: importing a module must not open a
 * connection or demand an environment, so `next build` can walk the module
 * graph and a service stays importable under test without a live database.
 * Only src/server/services/ calls this — routes delegate to services.
 */
export function getDb(): DrizzleDb {
  if (globalForDb.__cuadreDb) return globalForDb.__cuadreDb;
  const client = globalForDb.__cuadreSql ?? postgres(config.DATABASE_URL);
  const db = drizzle(client, { schema });
  globalForDb.__cuadreSql = client;
  globalForDb.__cuadreDb = db;
  return db;
}

/**
 * `db.select()` sugar over `getDb()`. Property access resolves the pool on
 * first use, not at import time. Methods are bound to the real handle so
 * drizzle's builders see the right `this`.
 */
export const db: DrizzleDb = new Proxy({} as DrizzleDb, {
  get: (_target, prop) => {
    const value = getDb()[prop as keyof DrizzleDb];
    return typeof value === "function" ? (value as (...args: unknown[]) => unknown).bind(getDb()) : value;
  },
});

/** Type-only — safe to import from code that must stay `server-only`-free (e.g. scripts/). */
export type Db = DrizzleDb;

export type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Wraps a multi-step write in one transaction. Services use this instead of
 * calling db.transaction directly, so db/client.ts stays the only place that
 * knows how a transaction is opened.
 */
export function withTransaction<T>(fn: (tx: Transaction) => Promise<T>): Promise<T> {
  return getDb().transaction(fn);
}
