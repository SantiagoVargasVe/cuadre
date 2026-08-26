import { config as loadEnv } from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { envSchema } from "../src/server/config.schema";
import * as schema from "../src/server/db/schema";
import { openErApiProvider } from "../src/server/fx/providers/open-er-api";
import { refreshCore } from "../src/server/fx/refresh-core";

/**
 * `npm run fx:refresh` — the identical code path the daily timer hits via
 * `POST /api/admin/fx/refresh`, run locally for debugging (ADR-0008).
 * Builds its own connection rather than importing src/server/db/client.ts,
 * which carries `server-only` and would throw outside Next — same reason
 * scripts/seed-invite.ts and drizzle.config.ts import config.schema.ts
 * instead of config.ts.
 *
 * Only wired to `open-er-api` directly rather than going through
 * `src/server/fx/providers/index.ts`'s `getRateProvider()` — that factory
 * reads the `server-only` `config` singleton. `FX_PROVIDER` currently has
 * exactly one value, so this is equivalent; if a second provider is ever
 * added, this switch needs the same branch getRateProvider() gets.
 */
async function main() {
  loadEnv({ quiet: true });
  const env = envSchema.parse(process.env);

  const sqlClient = postgres(env.DATABASE_URL, { max: 1 });
  const db = drizzle(sqlClient, { schema });

  try {
    const result = await refreshCore(
      db,
      openErApiProvider,
      env.FX_BASE_CURRENCY,
      env.SUPPORTED_CURRENCIES,
      env.FX_TRM_CROSSCHECK,
    );
    console.log(`\n  Inserted ${result.inserted} rate(s) for ${result.asOf} from ${result.source}.\n`);
  } finally {
    await sqlClient.end();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
