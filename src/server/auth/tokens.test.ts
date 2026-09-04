import { and, eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { getTestDb, hasTestDatabase, setupTestDb } from "../../test/db";
import { authTokens, users } from "../db/schema";
import { InvalidAuthTokenError } from "../errors";
import {
  consumeToken,
  deleteUserTokens,
  hashToken,
  mintToken,
  TOKEN_TTL_MS,
  type AuthTokenPurpose,
} from "./tokens";

describe.skipIf(!hasTestDatabase)("auth token mint/consume", () => {
  setupTestDb();

  async function seedUser() {
    const [user] = await getTestDb()
      .insert(users)
      .values({ email: `${crypto.randomUUID()}@example.com`, displayName: "Ana", passwordHash: "x" })
      .returning();
    return user!.id;
  }

  function consume(token: string, purpose: AuthTokenPurpose) {
    return getTestDb().transaction((tx) => consumeToken(tx, token, purpose));
  }

  it("round-trips a token for each purpose", async () => {
    const userId = await seedUser();

    for (const purpose of ["password_reset", "email_verify"] as const) {
      const token = await mintToken(getTestDb(), userId, purpose);
      await expect(consume(token, purpose)).resolves.toEqual({ userId });
    }
  });

  it("hands back the plaintext once and stores only its SHA-256", async () => {
    const userId = await seedUser();
    const token = await mintToken(getTestDb(), userId, "password_reset");

    const [row] = await getTestDb().select().from(authTokens).where(eq(authTokens.userId, userId));
    expect(row?.tokenHash).toBe(hashToken(token));
    expect(row?.tokenHash).not.toBe(token);
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/); // base64url
  });

  it("rejects a second use of the same token", async () => {
    const userId = await seedUser();
    const token = await mintToken(getTestDb(), userId, "password_reset");

    await consume(token, "password_reset");
    await expect(consume(token, "password_reset")).rejects.toBeInstanceOf(InvalidAuthTokenError);
  });

  it("rejects an expired token", async () => {
    const userId = await seedUser();
    const token = "expired-plaintext";
    await getTestDb().insert(authTokens).values({
      tokenHash: hashToken(token),
      userId,
      purpose: "password_reset",
      expiresAt: new Date(Date.now() - 60_000),
    });

    await expect(consume(token, "password_reset")).rejects.toBeInstanceOf(InvalidAuthTokenError);
  });

  it("rejects an unknown token", async () => {
    await expect(consume("never-minted", "password_reset")).rejects.toBeInstanceOf(InvalidAuthTokenError);
  });

  it("refuses cross-purpose redemption in both directions and leaves the row unused", async () => {
    const userId = await seedUser();

    const resetToken = await mintToken(getTestDb(), userId, "password_reset");
    await expect(consume(resetToken, "email_verify")).rejects.toBeInstanceOf(InvalidAuthTokenError);

    const verifyToken = await mintToken(getTestDb(), userId, "email_verify");
    await expect(consume(verifyToken, "password_reset")).rejects.toBeInstanceOf(InvalidAuthTokenError);

    // Both survived their wrong-purpose attempt and still work correctly.
    const rows = await getTestDb().select().from(authTokens).where(eq(authTokens.userId, userId));
    expect(rows.every((r) => r.usedAt === null)).toBe(true);
    await expect(consume(resetToken, "password_reset")).resolves.toEqual({ userId });
    await expect(consume(verifyToken, "email_verify")).resolves.toEqual({ userId });
  });

  it("invalidates siblings of the same purpose on mint but leaves the other purpose alone", async () => {
    const userId = await seedUser();

    const firstReset = await mintToken(getTestDb(), userId, "password_reset");
    const verify = await mintToken(getTestDb(), userId, "email_verify");
    const secondReset = await mintToken(getTestDb(), userId, "password_reset");

    await expect(consume(firstReset, "password_reset")).rejects.toBeInstanceOf(InvalidAuthTokenError);
    await expect(consume(secondReset, "password_reset")).resolves.toEqual({ userId });
    // The verification token minted in between was untouched.
    await expect(consume(verify, "email_verify")).resolves.toEqual({ userId });
  });

  it("deleteUserTokens clears the remaining siblings of one purpose", async () => {
    const userId = await seedUser();
    await mintToken(getTestDb(), userId, "password_reset");
    const verify = await mintToken(getTestDb(), userId, "email_verify");

    await getTestDb().transaction((tx) => deleteUserTokens(tx, userId, "password_reset"));

    const rows = await getTestDb()
      .select()
      .from(authTokens)
      .where(and(eq(authTokens.userId, userId)));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.purpose).toBe("email_verify");
    await expect(consume(verify, "email_verify")).resolves.toEqual({ userId });
  });

  it("uses the documented per-purpose expiries", () => {
    expect(TOKEN_TTL_MS.password_reset).toBe(30 * 60_000);
    expect(TOKEN_TTL_MS.email_verify).toBe(24 * 60 * 60_000);
  });
});
