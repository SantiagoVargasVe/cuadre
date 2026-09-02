import { NextRequest } from "next/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { getTestDb, hasTestDatabase, setupTestDb } from "../../../../../test/db";

const APP_URL = "http://localhost:3000";
const DATABASE_URL_TEST = process.env.DATABASE_URL_TEST;

describe.skipIf(!hasTestDatabase)("GET /api/groups/[id]/insights", () => {
  setupTestDb();

  let GET: typeof import("./route").GET;
  let createExpense: typeof import("../../../../../server/services/expenses").createExpense;
  let token: string;
  let outsiderToken: string;
  let groupId: string;
  let userId: string;

  beforeAll(async () => {
    vi.stubEnv("APP_URL", APP_URL);
    vi.stubEnv("DATABASE_URL", DATABASE_URL_TEST ?? "");
    vi.stubEnv("AUTH_SECRET", "a".repeat(48));
    vi.stubEnv("SUPPORTED_CURRENCIES", "COP,USD,EUR");
    vi.stubEnv("DEFAULT_CURRENCY", "COP");
    vi.stubEnv("FX_PROVIDER", "open-er-api");
    vi.stubEnv("FX_BASE_CURRENCY", "USD");
    vi.stubEnv("FX_TRM_CROSSCHECK", "true");
    ({ GET } = await import("./route"));
    ({ createExpense } = await import("../../../../../server/services/expenses"));
  });

  afterAll(() => vi.unstubAllEnvs());

  beforeEach(async () => {
    const [{ users }, { signSessionToken }, { createGroup }] = await Promise.all([
      import("../../../../../server/db/schema"),
      import("../../../../../server/auth/jwt"),
      import("../../../../../server/services/groups"),
    ]);
    const [user, outsider] = await getTestDb()
      .insert(users)
      .values([
        { email: `${crypto.randomUUID()}@example.com`, displayName: "Ana", passwordHash: "x" },
        { email: `${crypto.randomUUID()}@example.com`, displayName: "Nadie", passwordHash: "x" },
      ])
      .returning();
    userId = user!.id;
    token = await signSessionToken(user!.id);
    outsiderToken = await signSessionToken(outsider!.id);
    groupId = (await createGroup(user!.id, { title: "Trip" })).id;
  });

  function request(auth: string) {
    return GET(
      new NextRequest(`${APP_URL}/api/groups/${groupId}/insights`, {
        headers: { authorization: `Bearer ${auth}` },
      }),
      { params: Promise.resolve({ id: groupId }) },
    );
  }

  it("returns the server-computed aggregates for a member", async () => {
    await createExpense(groupId, userId, {
      title: "Cena",
      date: "2026-08-24",
      amount: "30000",
      currency: "COP",
      category: "comida",
      split: { strategy: "equal" },
    });

    const response = await request(token);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.displayCurrency).toBeNull();
    expect(body.byCurrency).toEqual([
      {
        currency: "COP",
        summary: {
          totalSpent: "30000",
          expenseCount: 1,
          firstExpenseDate: "2026-08-24",
          lastExpenseDate: "2026-08-24",
          averagePerExpense: "30000",
          largestExpense: { title: "Cena", amount: "30000", currency: "COP", payers: ["Ana"] },
          carrying: null,
        },
        byDay: [{ key: "2026-08-24", amount: "30000" }],
        byMonth: [{ key: "2026-08", amount: "30000" }],
        byCategory: [{ category: "comida", amount: "30000" }],
        members: [
          { userId, paid: "30000", consumed: "30000", expenseContribution: "0", sent: "0", received: "0", currentNet: "0" },
        ],
      },
    ]);
  });

  it("404s a non-member", async () => {
    const response = await request(outsiderToken);
    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ error: { code: "NOT_A_MEMBER" } });
  });
});
