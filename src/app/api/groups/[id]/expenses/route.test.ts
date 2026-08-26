import { NextRequest } from "next/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { hasTestDatabase, setupTestDb, getTestDb } from "../../../../../test/db";

const DATABASE_URL_TEST = process.env.DATABASE_URL_TEST;
const APP_URL = "http://localhost:3000";

describe.skipIf(!hasTestDatabase)("POST /api/groups/[id]/expenses", () => {
  setupTestDb();

  let expensesPOST: typeof import("./route").POST;
  let ownerToken: string;
  let outsiderToken: string;
  let groupId: string;

  beforeAll(async () => {
    vi.stubEnv("APP_URL", APP_URL);
    vi.stubEnv("DATABASE_URL", DATABASE_URL_TEST ?? "");
    vi.stubEnv("AUTH_SECRET", "a".repeat(48));
    vi.stubEnv("SUPPORTED_CURRENCIES", "COP,USD,EUR");
    vi.stubEnv("DEFAULT_CURRENCY", "COP");
    vi.stubEnv("FX_PROVIDER", "open-er-api");
    vi.stubEnv("FX_BASE_CURRENCY", "USD");
    vi.stubEnv("FX_TRM_CROSSCHECK", "true");

    ({ POST: expensesPOST } = await import("./route"));
  });

  afterAll(() => vi.unstubAllEnvs());

  beforeEach(async () => {
    const [{ users }, { signSessionToken }, { createGroup }] = await Promise.all([
      import("../../../../../server/db/schema"),
      import("../../../../../server/auth/jwt"),
      import("../../../../../server/services/groups"),
    ]);
    const [owner] = await getTestDb()
      .insert(users)
      .values({ email: "ana@example.com", displayName: "Ana", passwordHash: "x" })
      .returning();
    const [outsider] = await getTestDb()
      .insert(users)
      .values({ email: "outsider@example.com", displayName: "Nadie", passwordHash: "x" })
      .returning();
    ownerToken = await signSessionToken(owner!.id);
    outsiderToken = await signSessionToken(outsider!.id);
    groupId = (await createGroup(owner!.id, { title: "Cartagena 2026" })).id;
  });

  function ctx() {
    return { params: Promise.resolve({ id: groupId }) };
  }

  function req(token: string, body: unknown) {
    return new NextRequest(`${APP_URL}/api/groups/${groupId}/expenses`, {
      method: "POST",
      headers: { origin: APP_URL, authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  const validBody = {
    title: "Cena",
    date: "2026-08-24",
    amount: "30000000",
    currency: "COP",
    split: { strategy: "equal" },
  };

  it("creates an expense and echoes the resolved amounts", async () => {
    const response = await expensesPOST(req(ownerToken, validBody), ctx());
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.total).toEqual({ amount: "30000000", currency: "COP" });
    expect(body.payers).toEqual([{ userId: expect.any(String), amount: "30000000" }]);
    expect(body.version).toBe(1);
    expect(body.editedAt).toBeNull();
  });

  it("404s for a non-member", async () => {
    const response = await expensesPOST(req(outsiderToken, validBody), ctx());
    expect(response.status).toBe(404);
  });

  it("403s with no Origin and no Bearer", async () => {
    const response = await expensesPOST(
      new NextRequest(`${APP_URL}/api/groups/${groupId}/expenses`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(validBody),
      }),
      ctx(),
    );
    expect(response.status).toBe(403);
  });

  it("rejects an unsupported currency with 422 CURRENCY_NOT_SUPPORTED", async () => {
    const response = await expensesPOST(
      req(ownerToken, { ...validBody, currency: "JPY" }),
      ctx(),
    );
    expect(response.status).toBe(422);
    expect((await response.json()).error.code).toBe("CURRENCY_NOT_SUPPORTED");
  });
});
