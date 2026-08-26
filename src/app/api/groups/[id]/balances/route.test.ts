import { NextRequest } from "next/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { hasTestDatabase, setupTestDb, getTestDb } from "../../../../../test/db";

const DATABASE_URL_TEST = process.env.DATABASE_URL_TEST;
const APP_URL = "http://localhost:3000";

describe.skipIf(!hasTestDatabase)("/api/groups/[id]/balances", () => {
  setupTestDb();

  let balancesGET: typeof import("./route").GET;
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

    ({ GET: balancesGET } = await import("./route"));
  });

  afterAll(() => vi.unstubAllEnvs());

  beforeEach(async () => {
    const [{ users, groupMembers }, { signSessionToken }, { createGroup }, { createExpense }] =
      await Promise.all([
        import("../../../../../server/db/schema"),
        import("../../../../../server/auth/jwt"),
        import("../../../../../server/services/groups"),
        import("../../../../../server/services/expenses"),
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
    ownerToken = await signSessionToken(owner!.id);
    outsiderToken = await signSessionToken(outsider!.id);
    const group = await createGroup(owner!.id, { title: "Cartagena 2026" });
    groupId = group.id;
    await getTestDb().insert(groupMembers).values({ groupId, userId: beto!.id, role: "member" });
    await createExpense(groupId, owner!.id, {
      title: "Dinner",
      date: "2026-08-24",
      amount: "10000",
      currency: "COP",
      split: { strategy: "equal" },
    });
  });

  function ctx() {
    return { params: Promise.resolve({ id: groupId }) };
  }

  function req(query?: string) {
    const url = `${APP_URL}/api/groups/${groupId}/balances${query ? `?${query}` : ""}`;
    return new NextRequest(url, { headers: { authorization: `Bearer ${ownerToken}` } });
  }

  it("returns the documented shape with the raw plan by default", async () => {
    const response = await balancesGET(req(), ctx());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.byCurrency).toHaveLength(1);
    const cop = body.byCurrency[0];
    expect(cop.currency).toBe("COP");
    expect(cop.simplified).toBe(false);
    expect(typeof cop.members[0].net).toBe("string");
    expect(cop.plan[0].explains).toBeUndefined();
  });

  it("?simplify=on overrides without persisting", async () => {
    const on = await balancesGET(req("simplify=on"), ctx());
    expect((await on.json()).byCurrency[0].simplified).toBe(true);

    const after = await balancesGET(req(), ctx());
    expect((await after.json()).byCurrency[0].simplified).toBe(false);
  });

  it("asserts Σ net == 0 per currency", async () => {
    const response = await balancesGET(req(), ctx());
    const cop = (await response.json()).byCurrency[0];
    const total = cop.members.reduce((sum: bigint, m: { net: string }) => sum + BigInt(m.net), 0n);
    expect(total).toBe(0n);
  });

  it("404s for a non-member", async () => {
    const response = await balancesGET(
      new NextRequest(`${APP_URL}/api/groups/${groupId}/balances`, {
        headers: { authorization: `Bearer ${outsiderToken}` },
      }),
      ctx(),
    );
    expect(response.status).toBe(404);
  });
});
