import { parseArgs } from "node:util";
import { config as loadEnv } from "dotenv";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { mintToken, TOKEN_TTL_MS } from "../src/server/auth/tokens";
import { envSchema } from "../src/server/config.schema";
import * as schema from "../src/server/db/schema";

const { users } = schema;

/**
 * `npm run reset-link -- <email>` — mint a password-recovery link from the
 * host, with no mail vendor involved. What keeps ADR-0011's "email is
 * optional" true for the one feature that would otherwise force one.
 *
 * Three audiences: an operator who runs no SMTP provider; an operator
 * whose provider is failing right when someone needs in; and any member
 * whose address predates verification, who by ADR-0013 can't use
 * `/forgot-password` until they verify.
 *
 * Builds its own connection rather than importing src/server/db/client.ts,
 * which carries `server-only` and would throw outside Next — same trick as
 * scripts/fx-refresh.ts. It calls T122's `mintToken` unchanged: same
 * table, same 30-minute expiry, same single-use semantics, the identical
 * code path `POST /api/auth/forgot-password` will take (T125). If this
 * ever needed its own token path, T122 was scoped wrong.
 *
 * **It deliberately ignores `email_verified_at`.** An operator minting a
 * link has established identity out of band — a stronger signal than an
 * inbox round-trip — and this is the escape hatch that keeps an unverified
 * member recoverable. The enumeration rule in T125 is about what a
 * stranger can learn over HTTP; this is a host tool, so an unknown address
 * *should* say so.
 */
async function main() {
  loadEnv({ quiet: true });

  const { positionals } = parseArgs({ allowPositionals: true, options: {} });
  const email = positionals[0]?.trim();
  if (!email || positionals.length > 1) {
    console.error("Usage: npm run reset-link -- <email>");
    process.exit(1);
  }

  const env = envSchema.parse(process.env);
  const sql = postgres(env.DATABASE_URL, { max: 1 });
  const db = drizzle(sql, { schema });

  try {
    const [user] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (!user) {
      console.error(`No account registered for ${email}.`);
      process.exit(1);
    }

    const token = await mintToken(db, user.id, "password_reset");
    const url = `${env.APP_URL}/reset-password/${token}`;
    const expiresAt = new Date(Date.now() + TOKEN_TTL_MS.password_reset);

    console.log(`\n  Recovery link for ${email}:\n`);
    console.log(`  ${url}\n`);
    console.log(`  Expires:  ${expiresAt.toISOString()}  (30 minutes)`);
    console.log("  Single use, and a live credential — send it over a private channel,");
    console.log("  and don't paste it anywhere it will be logged.\n");
  } finally {
    await sql.end();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
