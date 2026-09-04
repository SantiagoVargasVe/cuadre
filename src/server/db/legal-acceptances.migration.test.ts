import { readFile } from "node:fs/promises";
import postgres from "postgres";
import { describe, expect, it } from "vitest";
import { hasTestDatabase, setupTestDb } from "../../test/db";

const DATABASE_URL_TEST = process.env.DATABASE_URL_TEST;

describe.skipIf(!hasTestDatabase)("0010 legal acceptance migration", () => {
  setupTestDb();

  it("backfills both documents for a legacy user without overwriting an existing record", async () => {
    const migration = await readFile(
      new URL("./migrations/0010_concerned_korvac.sql", import.meta.url),
      "utf8",
    );
    const statements = migration.split("--> statement-breakpoint").map((sql) => sql.trim()).filter(Boolean);
    const client = postgres(DATABASE_URL_TEST!, { max: 1 });
    let transactionOpen = false;
    try {
      await client.unsafe("BEGIN");
      transactionOpen = true;
      await client.unsafe('DROP TABLE "legal_acceptances"');
      await client.unsafe('DROP TYPE "legal_acceptance_source", "legal_document"');
      await client`
        INSERT INTO users (email, display_name, password_hash)
        VALUES ('legacy@example.com', 'Legacy', 'hash')
      `;
      for (const statement of statements.slice(0, -1)) await client.unsafe(statement);
      await client`
        INSERT INTO legal_acceptances
          (user_id, document, document_version, acknowledged_at, source)
        SELECT id, 'terms', '2026-09-03', '2026-01-01', 'registration'
        FROM users WHERE email = 'legacy@example.com'
      `;
      await client.unsafe(statements.at(-1)!);
      const rows = await client<{
        document: string;
        document_version: string;
        source: string;
        acknowledged_at: Date;
      }[]>`
        SELECT document, document_version, source, acknowledged_at
        FROM legal_acceptances ORDER BY document
      `;

      expect(rows.map(({ document, document_version }) => ({ document, document_version }))).toEqual([
        { document: "terms", document_version: "2026-09-03" },
        { document: "privacy", document_version: "2026-09-03" },
      ]);
      expect(rows[0]?.source).toBe("registration");
      expect(rows[0]?.acknowledged_at).toEqual(new Date("2026-01-01T00:00:00.000Z"));
      expect(rows[1]?.source).toBe("legacy_backfill");

      await client.unsafe("SAVEPOINT immutable_update");
      await expect(client`UPDATE legal_acceptances SET source = 'legacy_backfill'`).rejects.toThrow(/immutable/);
      await client.unsafe("ROLLBACK TO SAVEPOINT immutable_update");
      await client.unsafe("SAVEPOINT immutable_delete");
      await expect(client`DELETE FROM legal_acceptances`).rejects.toThrow(/immutable/);
      await client.unsafe("ROLLBACK TO SAVEPOINT immutable_delete");
    } finally {
      if (transactionOpen) await client.unsafe("ROLLBACK");
      await client.end();
    }
  });
});
