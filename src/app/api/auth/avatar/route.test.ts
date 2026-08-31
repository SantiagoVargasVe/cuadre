import { eq } from "drizzle-orm";
import { NextRequest } from "next/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { getTestDb, hasTestDatabase, setupTestDb } from "../../../../test/db";
import { users } from "../../../../server/db/schema";

const DATABASE_URL_TEST = process.env.DATABASE_URL_TEST;
const APP_URL = "http://localhost:3000";

describe.skipIf(!hasTestDatabase)("PUT /api/auth/avatar (T108)", () => {
  setupTestDb();

  let PUT: typeof import("./route").PUT;
  let signSessionToken: typeof import("../../../../server/auth/jwt").signSessionToken;
  let aliceToken: string;
  let aliceId: string;

  beforeAll(async () => {
    vi.stubEnv("APP_URL", APP_URL);
    vi.stubEnv("DATABASE_URL", DATABASE_URL_TEST ?? "");
    vi.stubEnv("AUTH_SECRET", "a".repeat(48));
    vi.stubEnv("SUPPORTED_CURRENCIES", "COP,USD,EUR");
    vi.stubEnv("DEFAULT_CURRENCY", "COP");
    vi.stubEnv("FX_PROVIDER", "open-er-api");
    vi.stubEnv("FX_BASE_CURRENCY", "USD");
    vi.stubEnv("FX_TRM_CROSSCHECK", "false");
    ({ PUT } = await import("./route"));
    ({ signSessionToken } = await import("../../../../server/auth/jwt"));
  });

  afterAll(() => vi.unstubAllEnvs());

  beforeEach(async () => {
    const [alice] = await getTestDb()
      .insert(users)
      .values({ email: `${crypto.randomUUID()}@example.com`, displayName: "Alice", passwordHash: "x" })
      .returning();
    aliceId = alice!.id;
    aliceToken = await signSessionToken(aliceId);
  });

  const req = (body: unknown, token = aliceToken) =>
    new NextRequest(`${APP_URL}/api/auth/avatar`, {
      method: "PUT",
      headers: { origin: APP_URL, authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify(body),
    });

  it("stores a valid choice and returns it — no email in the response", async () => {
    const res = await PUT(req({ variant: "pixel", seed: "abcdef123", palette: "warm" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.avatar).toEqual({ variant: "pixel", seed: "abcdef123", palette: "warm" });
    expect(JSON.stringify(body)).not.toContain("@");
  });

  it("null resets to the T107 default by clearing the columns", async () => {
    await PUT(req({ variant: "ring", seed: "seedone", palette: "cool" }));
    expect((await (await PUT(req(null))).json()).avatar).toBeNull();

    const [row] = await getTestDb().select().from(users).where(eq(users.id, aliceId));
    expect([row!.avatarVariant, row!.avatarSeed, row!.avatarPalette]).toEqual([null, null, null]);
  });

  it("rejects an unknown variant or palette (400)", async () => {
    expect((await PUT(req({ variant: "sketch", seed: "abcdef", palette: "warm" }))).status).toBe(400);
    expect((await PUT(req({ variant: "beam", seed: "abcdef", palette: "neon" }))).status).toBe(400);
  });

  it("rejects a free-text-looking seed (400) — seeds are app-generated only", async () => {
    expect((await PUT(req({ variant: "beam", seed: "hi mom", palette: "warm" }))).status).toBe(400);
    expect((await PUT(req({ variant: "beam", seed: "x", palette: "warm" }))).status).toBe(400);
  });

  it("changes only the session user's avatar — a userId in the body is ignored", async () => {
    const db = getTestDb();
    const [bob] = await db
      .insert(users)
      .values({ email: `${crypto.randomUUID()}@example.com`, displayName: "Bob", passwordHash: "x" })
      .returning();

    await PUT(req({ variant: "marble", seed: "seedxyz", palette: "cool", userId: bob!.id } as never));

    const withMarble = (await db.select().from(users)).filter((r) => r.avatarVariant === "marble");
    expect(withMarble.map((r) => r.id)).toEqual([aliceId]);
    const [bobRow] = await db.select().from(users).where(eq(users.id, bob!.id));
    expect(bobRow!.avatarVariant).toBeNull();
  });

  it("403s without a trusted Origin and no Bearer", async () => {
    const res = await PUT(
      new NextRequest(`${APP_URL}/api/auth/avatar`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(null),
      }),
    );
    expect(res.status).toBe(403);
  });
});
