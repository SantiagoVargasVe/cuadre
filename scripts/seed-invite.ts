import { parseArgs } from "node:util";
import { config as loadEnv } from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import { nanoid } from "nanoid";
import postgres from "postgres";
import { envSchema } from "../src/server/config.schema";
import { inviteCodes } from "../src/server/db/schema";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Mints a registration or group invite code.
 *
 *   npm run seed:invite
 *   npm run seed:invite -- --expires 2026-09-01 --group <uuid>
 *
 * Builds its own connection rather than importing src/server/db/client.ts,
 * which carries `server-only` and would throw outside Next — same reason
 * drizzle.config.ts imports config.schema.ts instead of config.ts.
 *
 * `--group` isn't validated against the groups table — it doesn't exist
 * until T020, which also adds the FK. Only its shape is checked here.
 */
async function main() {
  loadEnv({ quiet: true });

  const { values } = parseArgs({
    options: {
      expires: { type: "string" },
      group: { type: "string" },
    },
  });

  let expiresAt: Date | undefined;
  if (values.expires) {
    expiresAt = new Date(values.expires);
    if (Number.isNaN(expiresAt.getTime())) {
      throw new Error(`--expires "${values.expires}" is not a valid date`);
    }
  }

  if (values.group && !UUID_RE.test(values.group)) {
    throw new Error(`--group "${values.group}" is not a UUID`);
  }

  const env = envSchema.parse(process.env);
  const sql = postgres(env.DATABASE_URL, { max: 1 });

  try {
    const code = nanoid(16);
    await drizzle(sql)
      .insert(inviteCodes)
      .values({ code, expiresAt, groupId: values.group });

    console.log(`\n  Invite code:  ${code}\n`);
    console.log("  Single use. Hand it to whoever is registering.\n");
  } finally {
    await sql.end();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
