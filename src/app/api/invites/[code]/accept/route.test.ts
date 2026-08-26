import { NextRequest } from "next/server";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { hasTestDatabase, setupTestDb, getTestDb } from "../../../../../test/db";

const DATABASE_URL_TEST = process.env.DATABASE_URL_TEST;
const APP_URL = "http://localhost:3000";

describe.skipIf(!hasTestDatabase)("POST /api/invites/[code]/accept", () => {
  setupTestDb();

  let acceptPOST: typeof import("./route").POST;

  beforeAll(async () => {
    vi.stubEnv("APP_URL", APP_URL);
    vi.stubEnv("DATABASE_URL", DATABASE_URL_TEST ?? "");
    vi.stubEnv("AUTH_SECRET", "a".repeat(48));
    vi.stubEnv("SUPPORTED_CURRENCIES", "COP,USD,EUR");
    vi.stubEnv("DEFAULT_CURRENCY", "COP");
    vi.stubEnv("FX_PROVIDER", "open-er-api");
    vi.stubEnv("FX_BASE_CURRENCY", "USD");
    vi.stubEnv("FX_TRM_CROSSCHECK", "true");

    ({ POST: acceptPOST } = await import("./route"));
  });

  afterAll(() => vi.unstubAllEnvs());

  function ctx(code: string) {
    return { params: Promise.resolve({ code }) };
  }

  it("rejects with no session", async () => {
    const response = await acceptPOST(
      new NextRequest(`${APP_URL}/api/invites/whatever/accept`, {
        method: "POST",
        headers: { origin: APP_URL },
      }),
      ctx("whatever"),
    );
    expect(response.status).toBe(401);
  });

  it("403s with no Origin and no Bearer", async () => {
    const response = await acceptPOST(
      new NextRequest(`${APP_URL}/api/invites/whatever/accept`, { method: "POST" }),
      ctx("whatever"),
    );
    expect(response.status).toBe(403);
  });

  it("joins the group and returns it for a valid code", async () => {
    const [{ users, groups, inviteCodes }, { signSessionToken }] = await Promise.all([
      import("../../../../../server/db/schema"),
      import("../../../../../server/auth/jwt"),
    ]);
    const [owner] = await getTestDb()
      .insert(users)
      .values({ email: "ana@example.com", displayName: "Ana", passwordHash: "x" })
      .returning();
    const [invitee] = await getTestDb()
      .insert(users)
      .values({ email: "beto@example.com", displayName: "Beto", passwordHash: "x" })
      .returning();
    const [group] = await getTestDb()
      .insert(groups)
      .values({ title: "Cartagena 2026", defaultCurrency: "COP", createdBy: owner!.id })
      .returning();
    await getTestDb().insert(inviteCodes).values({ code: "accept-route-1", groupId: group!.id, createdBy: owner!.id });
    const token = await signSessionToken(invitee!.id);

    const response = await acceptPOST(
      new NextRequest(`${APP_URL}/api/invites/accept-route-1/accept`, {
        method: "POST",
        headers: { origin: APP_URL, authorization: `Bearer ${token}` },
      }),
      ctx("accept-route-1"),
    );

    expect(response.status).toBe(200);
    expect((await response.json()).group.id).toBe(group!.id);
  });

  it("409s for a code that doesn't exist", async () => {
    const { signSessionToken } = await import("../../../../../server/auth/jwt");
    const token = await signSessionToken(crypto.randomUUID());

    const response = await acceptPOST(
      new NextRequest(`${APP_URL}/api/invites/nope/accept`, {
        method: "POST",
        headers: { origin: APP_URL, authorization: `Bearer ${token}` },
      }),
      ctx("nope"),
    );
    expect(response.status).toBe(409);
  });
});
