import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { getTestDb, hasTestDatabase, setupTestDb } from "../../test/db";
import { authTokens, users } from "../db/schema";

const DATABASE_URL_TEST = process.env.DATABASE_URL_TEST;

describe.skipIf(!hasTestDatabase)("password-reset service", () => {
  setupTestDb();

  let resetPassword: typeof import("./password-reset").resetPassword;
  let markEmailVerified: typeof import("./password-reset").markEmailVerified;
  let mintToken: typeof import("../auth/tokens").mintToken;
  let verifyPassword: typeof import("../auth/password").verifyPassword;
  let hashPassword: typeof import("../auth/password").hashPassword;
  let InvalidAuthTokenError: typeof import("../errors").InvalidAuthTokenError;

  beforeAll(async () => {
    vi.stubEnv("APP_URL", "http://localhost:3000");
    vi.stubEnv("DATABASE_URL", DATABASE_URL_TEST ?? "");
    vi.stubEnv("AUTH_SECRET", "a".repeat(48));
    vi.stubEnv("SUPPORTED_CURRENCIES", "COP,USD,EUR");
    vi.stubEnv("DEFAULT_CURRENCY", "COP");
    vi.stubEnv("FX_PROVIDER", "open-er-api");
    vi.stubEnv("FX_BASE_CURRENCY", "USD");
    vi.stubEnv("FX_TRM_CROSSCHECK", "true");

    ({ resetPassword, markEmailVerified } = await import("./password-reset"));
    ({ mintToken } = await import("../auth/tokens"));
    ({ verifyPassword, hashPassword } = await import("../auth/password"));
    ({ InvalidAuthTokenError } = await import("../errors"));
  });

  afterAll(() => vi.unstubAllEnvs());

  async function seedUser() {
    const [user] = await getTestDb()
      .insert(users)
      .values({
        email: `${crypto.randomUUID()}@example.com`,
        displayName: "Ana",
        passwordHash: await hashPassword("old-password-1"),
      })
      .returning();
    return user!;
  }

  function readUser(id: string) {
    return getTestDb().select().from(users).where(eq(users.id, id)).then((r) => r[0]!);
  }

  describe("resetPassword", () => {
    it("writes the new hash, burns the token, and moves the session epoch forward", async () => {
      const user = await seedUser();
      const token = await mintToken(getTestDb(), user.id, "password_reset");

      await resetPassword(token, "brand-new-password");

      const after = await readUser(user.id);
      expect(await verifyPassword("brand-new-password", after.passwordHash)).toBe(true);
      expect(await verifyPassword("old-password-1", after.passwordHash)).toBe(false);
      expect(after.sessionsValidFrom.getTime()).toBeGreaterThan(user.sessionsValidFrom.getTime());
      // whole-second boundary preserved (T119 / ADR-0012)
      expect(after.sessionsValidFrom.getMilliseconds()).toBe(0);

      const leftover = await getTestDb().select().from(authTokens).where(eq(authTokens.userId, user.id));
      expect(leftover).toHaveLength(0);
    });

    it("also deletes the user's other outstanding password_reset tokens", async () => {
      const user = await seedUser();
      await mintToken(getTestDb(), user.id, "password_reset"); // stale sibling, not the one used
      const token = await mintToken(getTestDb(), user.id, "password_reset");

      await resetPassword(token, "brand-new-password");

      const leftover = await getTestDb()
        .select()
        .from(authTokens)
        .where(and(eq(authTokens.userId, user.id), eq(authTokens.purpose, "password_reset")));
      expect(leftover).toHaveLength(0);
    });

    it("rejects a reused token", async () => {
      const user = await seedUser();
      const token = await mintToken(getTestDb(), user.id, "password_reset");
      await resetPassword(token, "brand-new-password");

      await expect(resetPassword(token, "another-one")).rejects.toBeInstanceOf(InvalidAuthTokenError);
    });

    it("lets exactly one of two concurrent resets win on the same token", async () => {
      const user = await seedUser();
      const token = await mintToken(getTestDb(), user.id, "password_reset");

      const results = await Promise.allSettled([
        resetPassword(token, "winner-or-loser-A"),
        resetPassword(token, "winner-or-loser-B"),
      ]);

      const fulfilled = results.filter((r) => r.status === "fulfilled");
      const rejected = results.filter((r) => r.status === "rejected");
      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);
      expect((rejected[0] as PromiseRejectedResult).reason).toBeInstanceOf(InvalidAuthTokenError);

      const after = await readUser(user.id);
      const wonWithA = await verifyPassword("winner-or-loser-A", after.passwordHash);
      const wonWithB = await verifyPassword("winner-or-loser-B", after.passwordHash);
      expect(wonWithA !== wonWithB).toBe(true); // exactly one of the two passwords is now live
    });

    it("refuses an email_verify token and changes nothing", async () => {
      const user = await seedUser();
      const token = await mintToken(getTestDb(), user.id, "email_verify");

      await expect(resetPassword(token, "should-not-apply")).rejects.toBeInstanceOf(InvalidAuthTokenError);

      const after = await readUser(user.id);
      expect(await verifyPassword("old-password-1", after.passwordHash)).toBe(true);
      expect(after.sessionsValidFrom.getTime()).toBe(user.sessionsValidFrom.getTime());
    });
  });

  describe("markEmailVerified", () => {
    it("sets email_verified_at from a verify token", async () => {
      const user = await seedUser();
      expect(user.emailVerifiedAt).toBeNull();
      const token = await mintToken(getTestDb(), user.id, "email_verify");

      await markEmailVerified(token);

      expect((await readUser(user.id)).emailVerifiedAt).toBeInstanceOf(Date);
    });

    it("is a no-op success when already verified and keeps the first instant", async () => {
      const user = await seedUser();
      await markEmailVerified(await mintToken(getTestDb(), user.id, "email_verify"));
      const firstInstant = (await readUser(user.id)).emailVerifiedAt!;

      await new Promise((r) => setTimeout(r, 1100));
      await markEmailVerified(await mintToken(getTestDb(), user.id, "email_verify"));

      expect((await readUser(user.id)).emailVerifiedAt!.getTime()).toBe(firstInstant.getTime());
    });

    it("refuses a password_reset token and does not touch the session epoch", async () => {
      const user = await seedUser();
      const token = await mintToken(getTestDb(), user.id, "password_reset");

      await expect(markEmailVerified(token)).rejects.toBeInstanceOf(InvalidAuthTokenError);

      const after = await readUser(user.id);
      expect(after.emailVerifiedAt).toBeNull();
      expect(after.sessionsValidFrom.getTime()).toBe(user.sessionsValidFrom.getTime());
    });
  });
});
