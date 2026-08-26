import { NextRequest } from "next/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { hasTestDatabase, setupTestDb, getTestDb } from "../../../../test/db";

const DATABASE_URL_TEST = process.env.DATABASE_URL_TEST;
const APP_URL = "http://localhost:3000";

describe.skipIf(!hasTestDatabase)("/api/settlements/[id]", () => {
  setupTestDb();

  let settlementPATCH: typeof import("./route").PATCH;
  let settlementDELETE: typeof import("./route").DELETE;
  let ownerToken: string;
  let outsiderToken: string;
  let settlementId: string;
  let anaId: string;
  let betoId: string;

  beforeAll(async () => {
    vi.stubEnv("APP_URL", APP_URL);
    vi.stubEnv("DATABASE_URL", DATABASE_URL_TEST ?? "");
    vi.stubEnv("AUTH_SECRET", "a".repeat(48));
    vi.stubEnv("SUPPORTED_CURRENCIES", "COP,USD,EUR");
    vi.stubEnv("DEFAULT_CURRENCY", "COP");
    vi.stubEnv("FX_PROVIDER", "open-er-api");
    vi.stubEnv("FX_BASE_CURRENCY", "USD");
    vi.stubEnv("FX_TRM_CROSSCHECK", "true");

    ({ PATCH: settlementPATCH, DELETE: settlementDELETE } = await import("./route"));
  });

  afterAll(() => vi.unstubAllEnvs());

  beforeEach(async () => {
    const [{ users, groupMembers }, { signSessionToken }, { createGroup }, { createSettlement }] =
      await Promise.all([
        import("../../../../server/db/schema"),
        import("../../../../server/auth/jwt"),
        import("../../../../server/services/groups"),
        import("../../../../server/services/settlements"),
      ]);
    const db = getTestDb();
    const user = (name: string) =>
      db.insert(users).values({ email: `${name}@x.com`, displayName: name, passwordHash: "x" }).returning();
    const [[owner], [beto], [outsider]] = await Promise.all([user("ana"), user("beto"), user("outsider")]);
    anaId = owner!.id;
    betoId = beto!.id;
    ownerToken = await signSessionToken(owner!.id);
    outsiderToken = await signSessionToken(outsider!.id);
    const group = await createGroup(owner!.id, { title: "Cartagena 2026" });
    await db.insert(groupMembers).values({ groupId: group.id, userId: beto!.id, role: "member" });
    const settlement = await createSettlement(group.id, betoId, {
      toUserId: anaId,
      amount: "1000",
      currency: "COP",
      settledOn: "2026-08-24",
    });
    settlementId = settlement.id;
  });

  const ctx = () => ({ params: Promise.resolve({ id: settlementId }) });

  function req(method: string, token: string, body?: unknown) {
    return new NextRequest(`${APP_URL}/api/settlements/${settlementId}`, {
      method,
      headers: { origin: APP_URL, authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  }

  function patchBody() {
    return { toUserId: anaId, amount: "2000", currency: "COP", settledOn: "2026-08-25" };
  }

  it("PATCH replaces the settlement, keeping fromUserId", async () => {
    const response = await settlementPATCH(req("PATCH", ownerToken, patchBody()), ctx());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.fromUserId).toBe(betoId);
    expect(body.amount).toBe("2000");
    expect(body.settledOn).toBe("2026-08-25");
  });

  it("PATCH 404s for a non-member — the id-addressed case", async () => {
    const response = await settlementPATCH(req("PATCH", outsiderToken, patchBody()), ctx());
    expect(response.status).toBe(404);
  });

  it("PATCH 403s with no Origin and no Bearer", async () => {
    const response = await settlementPATCH(
      new NextRequest(`${APP_URL}/api/settlements/${settlementId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(patchBody()),
      }),
      ctx(),
    );
    expect(response.status).toBe(403);
  });

  it("DELETE soft-deletes and returns 204", async () => {
    const response = await settlementDELETE(req("DELETE", ownerToken), ctx());
    expect(response.status).toBe(204);
  });

  it("DELETE 404s for a non-member", async () => {
    const response = await settlementDELETE(req("DELETE", outsiderToken), ctx());
    expect(response.status).toBe(404);
  });
});
