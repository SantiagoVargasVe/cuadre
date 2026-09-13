/**
 * Runs pending migrations once, at process boot, in production only.
 *
 * Safe because this app runs as exactly one instance (see
 * docs/context/architecture.md § Operational notes) — migrations at
 * startup race with replicas, which is the reason to move them to a
 * release step before ever running two containers. Guarded to the Node
 * runtime because instrumentation.ts also loads under the Edge runtime,
 * where neither `postgres` nor migrations make sense.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.NODE_ENV !== "production") {
    return;
  }

  const { runStartup } = await import("./server/startup");
  await runStartup(async () => {
    const [{ runMigrations }, { config }, { waitForDatabase }] = await Promise.all([
      import("./server/db/migrate"),
      import("./server/config"),
      import("./server/db/wait-for-database"),
    ]);
    await waitForDatabase(config.DATABASE_URL);
    await runMigrations(config.DATABASE_URL);
  });
}
