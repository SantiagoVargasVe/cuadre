import { NextRequest } from "next/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { hasTestDatabase, setupTestDb, getTestDb } from "../../../../test/db";

const DATABASE_URL_TEST = process.env.DATABASE_URL_TEST;
const APP_URL = "http://localhost:3000";

describe.skipIf(!hasTestDatabase)("GET /api/expenses/[id]", () => {
  setupTestDb();

  let expenseGET: typeof import("./route").GET;
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

    ({ GET: expenseGET } = await import("./route"));
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

  function req(token: string) {
    return new NextRequest(`${APP_URL}/api/expenses/${expenseId}`, {
      headers: { authorization: `Bearer ${token}` },
    });
  }

  it("returns the expense detail with version and editedAt", async () => {
    const response = await expenseGET(req(ownerToken), ctx());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.version).toBe(1);
    expect(body.editedAt).toBeNull();
    expect(body.payers[0]).toMatchObject({ displayName: "Ana" });
    expect(body.split).toEqual({ strategy: "equal", members: [body.payers[0].userId] });
  });

  it("404s for a non-member", async () => {
    const response = await expenseGET(req(outsiderToken), ctx());
    expect(response.status).toBe(404);
  });
});
