import { eq } from "drizzle-orm";
import { NextRequest } from "next/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { getTestDb, hasTestDatabase, setupTestDb } from "../../../../test/db";
import { groupMembers, groups, users } from "../../../../server/db/schema";

const DATABASE_URL_TEST = process.env.DATABASE_URL_TEST;
const APP_URL = "http://localhost:3000";

describe.skipIf(!hasTestDatabase)("PATCH /api/auth/profile (T109)", () => {
  setupTestDb();

  let PATCH: typeof import("./route").PATCH;
  let signSessionToken: typeof import("../../../../server/auth/jwt").signSessionToken;
  let expenseService: typeof import("../../../../server/services/expenses");
  let getGroupDetail: typeof import("../../../../server/services/groups").getGroupDetail;
  let listMembers: typeof import("../../../../server/services/members").listMembers;
  let settlementService: typeof import("../../../../server/services/settlements");
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
    ({ PATCH } = await import("./route"));
    ({ signSessionToken } = await import("../../../../server/auth/jwt"));
    expenseService = await import("../../../../server/services/expenses");
    ({ getGroupDetail } = await import("../../../../server/services/groups"));
    ({ listMembers } = await import("../../../../server/services/members"));
    settlementService = await import("../../../../server/services/settlements");
  });

  afterAll(() => vi.unstubAllEnvs());

  const newUser = async (displayName: string) =>
    (
      await getTestDb()
        .insert(users)
        .values({ email: `${crypto.randomUUID()}@example.com`, displayName, passwordHash: "x" })
        .returning()
    )[0]!;

  const nameOf = async (id: string) =>
    (await getTestDb().select().from(users).where(eq(users.id, id)))[0]!.displayName;

  beforeEach(async () => {
    aliceId = (await newUser("Alcie")).id;
    aliceToken = await signSessionToken(aliceId);
  });

  const req = (body: unknown, headers = { origin: APP_URL, authorization: `Bearer ${aliceToken}` }) =>
    new NextRequest(`${APP_URL}/api/auth/profile`, {
      method: "PATCH",
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify(body),
    });

  it("renames the session user and returns the new name — no email in the response", async () => {
    const res = await PATCH(req({ displayName: "Alicia" }));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.user).toEqual({ id: aliceId, displayName: "Alicia", avatar: null });
    expect(JSON.stringify(body)).not.toContain("@");
    expect(await nameOf(aliceId)).toBe("Alicia");
  });

  it("renames the session user only — a userId in the body is ignored", async () => {
    const bob = await newUser("Bob");
    await PATCH(req({ displayName: "Alicia", userId: bob.id } as never));

    expect(await nameOf(bob.id)).toBe("Bob");
    const renamed = (await getTestDb().select().from(users)).filter((r) => r.displayName === "Alicia");
    expect(renamed.map((r) => r.id)).toEqual([aliceId]);
  });

  it("shows the new name everywhere it's read from, and still no emails", async () => {
    const db = getTestDb();
    const bob = await newUser("Bob"); const [group] = await db.insert(groups).values({ title: "Cartagena", defaultCurrency: "COP", createdBy: aliceId }).returning();
    await db.insert(groupMembers).values([{ groupId: group!.id, userId: aliceId, role: "owner" }, { groupId: group!.id, userId: bob.id, role: "member" }]);
    await expenseService.createExpense(group!.id, aliceId, { title: "Cena", date: "2026-09-01", amount: "2000", currency: "COP", paidBy: [{ userId: aliceId, amount: "2000" }], split: { strategy: "equal" } });
    await settlementService.createSettlement(group!.id, aliceId, { toUserId: bob.id, amount: "1000", currency: "COP", settledOn: "2026-09-01" });

    await PATCH(req({ displayName: "Alicia" }));

    const detail = await getGroupDetail(group!.id, aliceId);
    const members = await listMembers(group!.id, aliceId);
    const expenses = await expenseService.listExpenses(group!.id, aliceId, {});
    const settlements = await settlementService.listSettlements(group!.id, aliceId, {});
    const renamedParties = [...expenses.items[0]!.payers, ...expenses.items[0]!.splits]
      .filter((party) => party.userId === aliceId);

    // Propagation check, not an ordering one — `.sort()` so it doesn't ride on
    // whatever order the members reads return (that order is pinned by its own
    // tests in the members/groups service suites).
    const shownNames = [...detail.members, ...members].map((m) => m.displayName).sort();
    expect(shownNames).toEqual(["Alicia", "Alicia", "Bob", "Bob"]);
    expect(renamedParties.every((party) => party.displayName === "Alicia")).toBe(true);
    expect(settlements.items[0]).toMatchObject({ fromUserId: aliceId, toUserId: bob.id });
    expect(detail.members.find((member) => member.userId === settlements.items[0]!.fromUserId)?.displayName).toBe("Alicia");
    for (const response of [detail.members, members, expenses, settlements]) expect(JSON.stringify(response)).not.toContain("@");
  });

  it("rejects an empty name, one past registration's 200-character bound, or none (400)", async () => {
    for (const body of [{ displayName: "" }, { displayName: "a".repeat(201) }, {}]) {
      expect((await PATCH(req(body))).status).toBe(400);
    }
    expect(await nameOf(aliceId)).toBe("Alcie");
  });

  it("401s without a session; 403s without a trusted Origin and no Bearer", async () => {
    const name = { displayName: "Alicia" };
    expect((await PATCH(req(name, { origin: APP_URL } as never))).status).toBe(401);
    expect((await PATCH(req(name, {} as never))).status).toBe(403);
  });
});
