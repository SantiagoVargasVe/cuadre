import { NextRequest } from "next/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { hasTestDatabase, setupTestDb, getTestDb } from "../../../../../test/db";

const DATABASE_URL_TEST = process.env.DATABASE_URL_TEST;
const APP_URL = "http://localhost:3000";

describe.skipIf(!hasTestDatabase)("/api/groups/[id]/settlements", () => {
  setupTestDb();

  let settlementsGET: typeof import("./route").GET;
  let settlementsPOST: typeof import("./route").POST;
  let ownerToken: string;
  let memberToken: string;
  let outsiderToken: string;
  let groupId: string;
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

    ({ GET: settlementsGET, POST: settlementsPOST } = await import("./route"));
  });

  afterAll(() => vi.unstubAllEnvs());

  beforeEach(async () => {
    const [{ users, groupMembers }, { signSessionToken }, { createGroup }] = await Promise.all([
      import("../../../../../server/db/schema"),
      import("../../../../../server/auth/jwt"),
      import("../../../../../server/services/groups"),
    ]);
    const [owner] = await getTestDb()
      .insert(users)
      .values({ email: "ana@example.com", displayName: "Ana", passwordHash: "x" })
      .returning();
    const [beto] = await getTestDb()
      .insert(users)
      .values({ email: "beto@example.com", displayName: "Beto", passwordHash: "x" })
      .returning();
    const [outsider] = await getTestDb()
      .insert(users)
      .values({ email: "outsider@example.com", displayName: "Nadie", passwordHash: "x" })
      .returning();
    anaId = owner!.id;
    betoId = beto!.id;
    ownerToken = await signSessionToken(owner!.id);
    memberToken = await signSessionToken(beto!.id);
    outsiderToken = await signSessionToken(outsider!.id);
    groupId = (await createGroup(owner!.id, { title: "Cartagena 2026" })).id;
    await getTestDb().insert(groupMembers).values({ groupId, userId: beto!.id, role: "member" });
  });

  function ctx() {
    return { params: Promise.resolve({ id: groupId }) };
  }

  function req(method: string, token: string, body?: unknown) {
    return new NextRequest(`${APP_URL}/api/groups/${groupId}/settlements`, {
      method,
      headers: { origin: APP_URL, authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  }

  function validBody() {
    return { toUserId: anaId, amount: "5000", currency: "COP", settledOn: "2026-08-24" };
  }

  it("POST records a settlement from the authenticated user", async () => {
    const response = await settlementsPOST(req("POST", memberToken, validBody()), ctx());
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.fromUserId).toBe(betoId);
    expect(body.toUserId).toBe(anaId);
    expect(body.amount).toBe("5000");
  });

  it("POST 404s for a non-member", async () => {
    const response = await settlementsPOST(req("POST", outsiderToken, validBody()), ctx());
    expect(response.status).toBe(404);
  });

  it("POST 403s with no Origin and no Bearer", async () => {
    const response = await settlementsPOST(
      new NextRequest(`${APP_URL}/api/groups/${groupId}/settlements`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(validBody()),
      }),
      ctx(),
    );
    expect(response.status).toBe(403);
  });

  it("GET returns the recorded settlement", async () => {
    await settlementsPOST(req("POST", ownerToken, { ...validBody(), toUserId: betoId }), ctx());

    const response = await settlementsGET(req("GET", ownerToken), ctx());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.items).toHaveLength(1);
    expect(body.items[0].toUserId).toBe(betoId);
  });
});
