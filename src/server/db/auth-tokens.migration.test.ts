import { readFile } from "node:fs/promises";
import postgres from "postgres";
import { describe, expect, it } from "vitest";
import { hasTestDatabase, setupTestDb } from "../../test/db";

const DATABASE_URL_TEST = process.env.DATABASE_URL_TEST;

/**
 * 0011 adds `auth_tokens` and two `users` columns on top of a schema that
 * already has rows. The only thing a plain schema test can't show is what
 * happens to those pre-existing rows, so this replays the migration
 * against a hand-rolled "legacy" user inside a rolled-back transaction —
 * the same technique as the 0010 backfill test.
 */
describe.skipIf(!hasTestDatabase)("0011 account recovery migration", () => {
  setupTestDb();

  it("backfills sessions_valid_from to a whole second and leaves email_verified_at null", async () => {
    const migration = await readFile(
      new URL("./migrations/0011_account_recovery.sql", import.meta.url),
      "utf8",
    );
    const statements = migration
      .split("--> statement-breakpoint")
      .map((sql) => sql.trim())
      .filter(Boolean);

    const client = postgres(DATABASE_URL_TEST!, { max: 1 });
    let transactionOpen = false;
    try {
      await client.unsafe("BEGIN");
      transactionOpen = true;

      // Rewind to the pre-0011 (production) shape.
      await client.unsafe('DROP TABLE "auth_tokens"');
      await client.unsafe('DROP TYPE "auth_token_purpose"');
      await client.unsafe(
        'ALTER TABLE "users" DROP COLUMN "email_verified_at", DROP COLUMN "sessions_valid_from"',
      );

      // A row that exists before the migration runs.
      await client`
        INSERT INTO users (email, display_name, password_hash)
        VALUES ('legacy@example.com', 'Legacy', 'hash')
      `;

      for (const statement of statements) await client.unsafe(statement);

      const [legacy] = await client<
        {
          email_verified_at: Date | null;
          sessions_valid_from: Date;
          sub_second_us: string;
          within_window: boolean;
        }[]
      >`
        SELECT
          email_verified_at,
          sessions_valid_from,
          EXTRACT(MICROSECONDS FROM sessions_valid_from)::bigint % 1000000 AS sub_second_us,
          (sessions_valid_from <= now() AND sessions_valid_from > now() - interval '5 minutes')
            AS within_window
        FROM users WHERE email = 'legacy@example.com'
      `;

      // No backfill of verification state — a mistyped address must not
      // come out the other side marked verified (ADR-0013).
      expect(legacy?.email_verified_at).toBeNull();

      // Backfilled, not left null…
      expect(legacy?.sessions_valid_from).toBeInstanceOf(Date);
      // …to a whole second (the `iat` granularity rule)…
      expect(legacy?.sub_second_us).toBe("0");
      // …at the migration instant: not epoch (a silent no-op) and not a
      // future value (which would bar re-login until it passed).
      expect(legacy?.within_window).toBe(true);

      // The column default keeps working for rows created afterwards.
      const [fresh] = await client<{ sub_second_us: string; is_null: boolean }[]>`
        WITH ins AS (
          INSERT INTO users (email, display_name, password_hash)
          VALUES ('fresh@example.com', 'Fresh', 'hash')
          RETURNING sessions_valid_from
        )
        SELECT
          EXTRACT(MICROSECONDS FROM sessions_valid_from)::bigint % 1000000 AS sub_second_us,
          sessions_valid_from IS NULL AS is_null
        FROM ins
      `;
      expect(fresh?.is_null).toBe(false);
      expect(fresh?.sub_second_us).toBe("0");
    } finally {
      if (transactionOpen) await client.unsafe("ROLLBACK");
      await client.end();
    }
  });
});
