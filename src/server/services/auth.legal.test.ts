import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { hasTestDatabase, setupTestDb, getTestDb } from "../../test/db";

const DATABASE_URL_TEST = process.env.DATABASE_URL_TEST;

describe.skipIf(!hasTestDatabase)("register — legal acceptance transaction", () => {
  setupTestDb();
  let register: typeof import("./auth").register;

  beforeAll(async () => {
    vi.stubEnv("DATABASE_URL", DATABASE_URL_TEST ?? "");
    vi.stubEnv("AUTH_SECRET", "a".repeat(48));
    vi.stubEnv("SUPPORTED_CURRENCIES", "COP,USD,EUR");
    vi.stubEnv("DEFAULT_CURRENCY", "COP");
    vi.stubEnv("FX_PROVIDER", "open-er-api");
    vi.stubEnv("FX_BASE_CURRENCY", "USD");
    vi.stubEnv("FX_TRM_CROSSCHECK", "true");
    ({ register } = await import("./auth"));
  });

  afterAll(() => vi.unstubAllEnvs());

  it("rolls the user and invite back when an acknowledgement insert fails", async () => {
    const db = getTestDb();
    const { inviteCodes, legalAcceptances, users } = await import("../db/schema");
    await db.insert(inviteCodes).values({ code: "legal-write-failure" });
    await db.execute(sql.raw(`
      CREATE FUNCTION reject_t118_acceptance() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF EXISTS (SELECT 1 FROM users WHERE id = NEW.user_id AND email = 'legal-failure@example.com') THEN
          RAISE EXCEPTION 'forced legal acceptance failure';
        END IF;
        RETURN NEW;
      END; $$;
      CREATE TRIGGER reject_t118_acceptance
      BEFORE INSERT ON legal_acceptances
      FOR EACH ROW EXECUTE FUNCTION reject_t118_acceptance();
    `));

    try {
      await expect(register({
        email: "legal-failure@example.com",
        displayName: "Legal failure",
        password: "correct horse battery staple",
        inviteCode: "legal-write-failure",
        termsAccepted: true,
        privacyAccepted: true,
      })).rejects.toThrow();
    } finally {
      await db.execute(sql.raw("DROP TRIGGER reject_t118_acceptance ON legal_acceptances"));
      await db.execute(sql.raw("DROP FUNCTION reject_t118_acceptance()"));
    }

    expect(await db.select().from(users)).toHaveLength(0);
    expect(await db.select().from(legalAcceptances)).toHaveLength(0);
    expect((await db.select().from(inviteCodes))[0]?.consumedAt).toBeNull();
  });
});
