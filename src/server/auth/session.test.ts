import { sql } from "drizzle-orm";
import { SignJWT } from "jose";
import { NextRequest } from "next/server";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { getTestDb, hasTestDatabase, setupTestDb } from "../../test/db";
import { users } from "../db/schema";
import { SESSION_COOKIE_NAME } from "./cookie";

const DATABASE_URL_TEST = process.env.DATABASE_URL_TEST;
const AUTH_SECRET = "a".repeat(48);

// getSessionFromCookies reads next/headers cookies(); the request-based
// paths don't touch it. A hoisted holder lets each test set the cookie.
const cookieHolder = vi.hoisted(() => ({ token: undefined as string | undefined }));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      name === SESSION_COOKIE_NAME && cookieHolder.token
        ? { value: cookieHolder.token }
        : undefined,
  }),
}));

async function signToken(subject: string, iatSeconds?: number) {
  const builder = new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(subject)
    .setExpirationTime("30d");
  builder.setIssuedAt(iatSeconds);
  return builder.sign(new TextEncoder().encode(AUTH_SECRET));
}

describe.skipIf(!hasTestDatabase)("session resolution with revocation", () => {
  setupTestDb();

  let session: typeof import("./session");
  let errors: typeof import("../errors");

  beforeAll(async () => {
    vi.stubEnv("APP_URL", "http://localhost:3000");
    vi.stubEnv("DATABASE_URL", DATABASE_URL_TEST ?? "");
    vi.stubEnv("AUTH_SECRET", AUTH_SECRET);
    vi.stubEnv("SUPPORTED_CURRENCIES", "COP,USD,EUR");
    vi.stubEnv("DEFAULT_CURRENCY", "COP");
    vi.stubEnv("FX_PROVIDER", "open-er-api");
    vi.stubEnv("FX_BASE_CURRENCY", "USD");
    vi.stubEnv("FX_TRM_CROSSCHECK", "true");
    session = await import("./session");
    errors = await import("../errors");
  });

  afterAll(() => {
    vi.unstubAllEnvs();
    cookieHolder.token = undefined;
  });

  async function seedUser() {
    const [user] = await getTestDb()
      .insert(users)
      .values({ email: `${crypto.randomUUID()}@example.com`, displayName: "Ana", passwordHash: "x" })
      .returning();
    return user!;
  }

  async function setSessionEpoch(userId: string, epochSeconds: number) {
    await getTestDb().execute(
      sql`UPDATE users SET sessions_valid_from = to_timestamp(${epochSeconds}) WHERE id = ${userId}`,
    );
  }

  function cookieRequest(token: string) {
    return new NextRequest("http://localhost:3000/api/auth/me", {
      headers: { cookie: `${SESSION_COOKIE_NAME}=${token}` },
    });
  }

  function bearerRequest(token: string) {
    return new NextRequest("http://localhost:3000/api/auth/me", {
      headers: { authorization: `Bearer ${token}` },
    });
  }

  it("resolves a valid, unrevoked token from both the cookie and the Bearer header", async () => {
    const user = await seedUser();
    const token = await signToken(user.id);

    expect(await session.getSession(cookieRequest(token))).toEqual({ userId: user.id });
    expect(await session.getSession(bearerRequest(token))).toEqual({ userId: user.id });
  });

  it("rejects a token issued before the session epoch moved forward — cookie and Bearer alike", async () => {
    const user = await seedUser();
    const token = await signToken(user.id); // iat ≈ now
    await setSessionEpoch(user.id, Math.floor(Date.now() / 1000) + 100); // bump into the future

    expect(await session.getSession(cookieRequest(token))).toBeNull();
    expect(await session.getSession(bearerRequest(token))).toBeNull();
  });

  it("still accepts a token issued after a past bump", async () => {
    const user = await seedUser();
    await setSessionEpoch(user.id, Math.floor(Date.now() / 1000) - 100);
    const token = await signToken(user.id);

    expect(await session.getSession(bearerRequest(token))).toEqual({ userId: user.id });
  });

  it("pins the whole-second boundary in both directions", async () => {
    const user = await seedUser();
    const epoch = Math.floor(Date.now() / 1000);
    await setSessionEpoch(user.id, epoch);

    // Issued *in* the revoking second → invalid.
    expect(await session.getSession(bearerRequest(await signToken(user.id, epoch - 1)))).toBeNull();
    // Issued in the following second → valid.
    expect(await session.getSession(bearerRequest(await signToken(user.id, epoch)))).toEqual({
      userId: user.id,
    });
    expect(await session.getSession(bearerRequest(await signToken(user.id, epoch + 1)))).toEqual({
      userId: user.id,
    });
  });

  it("returns null for a token whose user row no longer exists, without throwing", async () => {
    const token = await signToken("00000000-0000-0000-0000-000000000000");

    await expect(session.getSession(bearerRequest(token))).resolves.toBeNull();
  });

  it("returns null for a malformed token and never throws", async () => {
    await expect(session.getSession(cookieRequest("not-a-jwt"))).resolves.toBeNull();
    await expect(
      session.getSession(
        new NextRequest("http://localhost:3000/api/auth/me", {
          headers: { authorization: "Basic dXNlcjpwYXNz" },
        }),
      ),
    ).resolves.toBeNull();
  });

  it("returns null with no cookie and no bearer header", async () => {
    expect(
      await session.getSession(new NextRequest("http://localhost:3000/api/auth/me")),
    ).toBeNull();
  });

  describe("requireUserId", () => {
    it("returns the userId for a live session", async () => {
      const user = await seedUser();
      const token = await signToken(user.id);
      expect(await session.requireUserId(bearerRequest(token))).toBe(user.id);
    });

    it("throws UnauthorizedError when the session is missing", async () => {
      await expect(
        session.requireUserId(new NextRequest("http://localhost:3000/api/auth/me")),
      ).rejects.toBeInstanceOf(errors.UnauthorizedError);
    });

    it("throws UnauthorizedError when the token has been revoked", async () => {
      const user = await seedUser();
      const token = await signToken(user.id);
      await setSessionEpoch(user.id, Math.floor(Date.now() / 1000) + 100);

      await expect(session.requireUserId(bearerRequest(token))).rejects.toBeInstanceOf(
        errors.UnauthorizedError,
      );
    });
  });

  describe("getSessionFromCookies", () => {
    it("applies the same revocation check as getSession", async () => {
      const user = await seedUser();
      cookieHolder.token = await signToken(user.id);
      expect(await session.getSessionFromCookies()).toEqual({ userId: user.id });

      await setSessionEpoch(user.id, Math.floor(Date.now() / 1000) + 100);
      expect(await session.getSessionFromCookies()).toBeNull();
    });

    it("returns null with no session cookie", async () => {
      cookieHolder.token = undefined;
      expect(await session.getSessionFromCookies()).toBeNull();
    });
  });
});
