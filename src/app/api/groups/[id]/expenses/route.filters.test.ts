import { NextRequest } from "next/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { getTestDb, hasTestDatabase, setupTestDb } from "../../../../../test/db";

const DATABASE_URL_TEST = process.env.DATABASE_URL_TEST;
const APP_URL = "http://localhost:3000";

/** T115 — what the search/filter query matches. Error and authorization
 * cases live in the sibling `route.filters.errors.test.ts`. */
describe.skipIf(!hasTestDatabase)("GET /api/groups/[id]/expenses — filters", () => {
  setupTestDb();

  let expensesGET: typeof import("./route").GET;
  let token: string;
  let groupId: string;
  let betoId: string;

  beforeAll(async () => {
    for (const [key, value] of Object.entries({
      APP_URL,
      DATABASE_URL: DATABASE_URL_TEST ?? "",
      AUTH_SECRET: "a".repeat(48),
      SUPPORTED_CURRENCIES: "COP,USD,EUR",
      DEFAULT_CURRENCY: "COP",
      FX_PROVIDER: "open-er-api",
      FX_BASE_CURRENCY: "USD",
      FX_TRM_CROSSCHECK: "true",
    })) {
      vi.stubEnv(key, value);
    }
    ({ GET: expensesGET } = await import("./route"));
  });

  afterAll(() => vi.unstubAllEnvs());

  beforeEach(async () => {
    const [{ groupMembers, users }, { signSessionToken }, { createGroup }, { createExpense }] =
      await Promise.all([
        import("../../../../../server/db/schema"),
        import("../../../../../server/auth/jwt"),
        import("../../../../../server/services/groups"),
        import("../../../../../server/services/expenses"),
      ]);
    const db = getTestDb();
    const [ana, beto] = await db
      .insert(users)
      .values([
        { email: "ana@example.com", displayName: "Ana", passwordHash: "x" },
        { email: "beto@example.com", displayName: "Beto", passwordHash: "x" },
      ])
      .returning();
    betoId = beto!.id;
    token = await signSessionToken(ana!.id);
    groupId = (await createGroup(ana!.id, { title: "Cartagena 2026" })).id;
    // Joining goes through an invite in the app; a direct row is the same
    // membership and keeps this file about the query, not the join flow.
    await db.insert(groupMembers).values({ groupId, userId: betoId, role: "member" });

    await createExpense(groupId, ana!.id, {
      title: "Hotel Caribe",
      date: "2026-08-01",
      amount: "3000",
      currency: "COP",
      split: { strategy: "equal" },
      category: "alojamiento",
    });
    await createExpense(groupId, ana!.id, {
      title: "Taxi",
      date: "2026-08-20",
      amount: "3000",
      currency: "USD",
      paidBy: [{ userId: ana!.id, amount: "3000" }],
      split: { strategy: "equal_subset", members: [betoId] },
    });
  });

  async function titles(query: string) {
    const response = await expensesGET(
      new NextRequest(`${APP_URL}/api/groups/${groupId}/expenses${query}`, {
        headers: { authorization: `Bearer ${token}` },
      }),
      { params: Promise.resolve({ id: groupId }) },
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    return { titles: body.items.map((i: { title: string }) => i.title), cursor: body.nextCursor };
  }

  it("filters by search term, category, currency, member, and date range", async () => {
    expect((await titles("?q=hotel")).titles).toEqual(["Hotel Caribe"]);
    expect((await titles("?category=alojamiento")).titles).toEqual(["Hotel Caribe"]);
    expect((await titles("?category=uncategorised")).titles).toEqual(["Taxi"]);
    expect((await titles("?currency=USD")).titles).toEqual(["Taxi"]);
    expect((await titles(`?member=${betoId}`)).titles).toEqual(["Taxi", "Hotel Caribe"]);
    expect((await titles("?from=2026-08-02&to=2026-08-31")).titles).toEqual(["Taxi"]);
  });

  it("combines filters and leaves the unfiltered feed intact", async () => {
    expect((await titles("?q=a&currency=COP")).titles).toEqual(["Hotel Caribe"]);
    expect((await titles("")).titles).toHaveLength(2);
  });

  it("carries the filters through a cursor page", async () => {
    const first = await titles("?q=a&limit=1");
    expect(first.titles).toEqual(["Taxi"]);

    const second = await titles(`?q=a&limit=1&cursor=${encodeURIComponent(first.cursor)}`);
    expect(second.titles).toEqual(["Hotel Caribe"]);
    expect(second.cursor).toBeNull();
  });
});
