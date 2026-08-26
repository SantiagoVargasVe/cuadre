import { NextRequest } from "next/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { hasTestDatabase, setupTestDb, getTestDb } from "../../../../test/db";

const DATABASE_URL_TEST = process.env.DATABASE_URL_TEST;
const APP_URL = "http://localhost:3000";

describe.skipIf(!hasTestDatabase)("/api/expenses/[id]", () => {
  setupTestDb();

  let expensePATCH: typeof import("./route").PATCH;
  let expenseDELETE: typeof import("./route").DELETE;
  let ownerToken: string;
  let outsiderToken: string;
  let expenseId: string;

  beforeAll(async () => {
    vi.stubEnv("APP_URL", APP_URL);
    vi.stubEnv("DATABASE_URL", DATABASE_URL_TEST ?? "");
    vi.stubEnv("AUTH_SECRET", "a".repeat(48));
    vi.stubEnv("SUPPORTED_CURRENCIES", "COP,USD,EUR");
    vi.stubEnv("DEFAULT_CURRENCY", "COP");
    vi.stubEnv("FX_PROVIDER", "open-er-api");
    vi.stubEnv("FX_BASE_CURRENCY", "USD");
    vi.stubEnv("FX_TRM_CROSSCHECK", "true");

    ({ PATCH: expensePATCH, DELETE: expenseDELETE } = await import("./route"));
  });

  afterAll(() => vi.unstubAllEnvs());

  beforeEach(async () => {
    const [{ users }, { signSessionToken }, { createGroup }, { createExpense }] = await Promise.all([
      import("../../../../server/db/schema"),
      import("../../../../server/auth/jwt"),
      import("../../../../server/services/groups"),
      import("../../../../server/services/expenses"),
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
    const group = await createGroup(owner!.id, { title: "Cartagena 2026" });
    const expense = await createExpense(group.id, owner!.id, {
      title: "Dinner",
      date: "2026-08-24",
      amount: "1000",
      currency: "COP",
      split: { strategy: "equal" },
    });
    expenseId = expense.id;
  });

  function ctx() {
    return { params: Promise.resolve({ id: expenseId }) };
  }

  function req(method: string, token: string, body?: unknown) {
    return new NextRequest(`${APP_URL}/api/expenses/${expenseId}`, {
      method,
      headers: { origin: APP_URL, authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  }

  const patchBody = {
    title: "Dinner (edited)",
    date: "2026-08-24",
    amount: "2000",
    currency: "COP",
    split: { strategy: "equal" },
  };

  it("PATCH replaces the expense and bumps version", async () => {
    const response = await expensePATCH(req("PATCH", ownerToken, patchBody), ctx());
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.version).toBe(2);
    expect(body.total.amount).toBe("2000");
  });

  it("PATCH 404s for a non-member — the id-addressed case", async () => {
    const response = await expensePATCH(req("PATCH", outsiderToken, patchBody), ctx());
    expect(response.status).toBe(404);
  });

  it("PATCH 403s with no Origin and no Bearer", async () => {
    const response = await expensePATCH(
      new NextRequest(`${APP_URL}/api/expenses/${expenseId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(patchBody),
      }),
      ctx(),
    );
    expect(response.status).toBe(403);
  });

  it("DELETE soft-deletes and returns 204", async () => {
    const response = await expenseDELETE(req("DELETE", ownerToken), ctx());
    expect(response.status).toBe(204);
  });

  it("DELETE 404s for a non-member", async () => {
    const response = await expenseDELETE(req("DELETE", outsiderToken), ctx());
    expect(response.status).toBe(404);
  });
});
