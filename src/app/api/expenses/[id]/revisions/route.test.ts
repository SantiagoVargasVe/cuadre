import { and, eq } from "drizzle-orm";
import { NextRequest } from "next/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { getTestDb, hasTestDatabase, setupTestDb } from "../../../../../test/db";
import { groupMembers } from "../../../../../server/db/schema";

const DATABASE_URL_TEST = process.env.DATABASE_URL_TEST;
const APP_URL = "http://localhost:3000";

describe.skipIf(!hasTestDatabase)("GET /api/expenses/[id]/revisions", () => {
  setupTestDb();

  let revisionsGET: typeof import("./route").GET;
  let updateExpense: typeof import("../../../../../server/services/expenses").updateExpense;
  let ownerToken: string;
  let outsiderToken: string;
  let memberToken: string;
  let expenseId: string;
  let ownerId: string;
  let groupId: string;
  let memberId: string;

  beforeAll(async () => {
    vi.stubEnv("APP_URL", APP_URL);
    vi.stubEnv("DATABASE_URL", DATABASE_URL_TEST ?? "");
    vi.stubEnv("AUTH_SECRET", "a".repeat(48));
    vi.stubEnv("SUPPORTED_CURRENCIES", "COP,USD,EUR");
    vi.stubEnv("DEFAULT_CURRENCY", "COP");
    vi.stubEnv("FX_PROVIDER", "open-er-api");
    vi.stubEnv("FX_BASE_CURRENCY", "USD");
    vi.stubEnv("FX_TRM_CROSSCHECK", "true");
    ({ GET: revisionsGET } = await import("./route"));
  });

  afterAll(() => vi.unstubAllEnvs());

  beforeEach(async () => {
    const [{ users }, { signSessionToken }, { createGroup }, expensesModule] = await Promise.all([
      import("../../../../../server/db/schema"),
      import("../../../../../server/auth/jwt"),
      import("../../../../../server/services/groups"),
      import("../../../../../server/services/expenses"),
    ]);
    ({ updateExpense } = expensesModule);
    const [owner] = await getTestDb().insert(users).values({ email: "ana@example.com", displayName: "Ana", passwordHash: "x" }).returning();
    const [member] = await getTestDb().insert(users).values({ email: "beto@example.com", displayName: "Beto", passwordHash: "x" }).returning();
    const [outsider] = await getTestDb().insert(users).values({ email: "caro@example.com", displayName: "Caro", passwordHash: "x" }).returning();
    ownerId = owner!.id;
    ownerToken = await signSessionToken(owner!.id);
    memberToken = await signSessionToken(member!.id);
    outsiderToken = await signSessionToken(outsider!.id);
    const group = await createGroup(owner!.id, { title: "Cartagena" });
    groupId = group.id;
    memberId = member!.id;
    await getTestDb().insert(groupMembers).values({ groupId, userId: memberId, role: "member" });
    expenseId = (await expensesModule.createExpense(groupId, owner!.id, { title: "Cena", date: "2026-08-24", amount: "1000", currency: "COP", split: { strategy: "equal" } })).id;
  });

  function context() {
    return { params: Promise.resolve({ id: expenseId }) };
  }

  function request(token: string) {
    return new NextRequest(`${APP_URL}/api/expenses/${expenseId}/revisions`, { headers: { authorization: `Bearer ${token}` } });
  }

  it("returns creation history without a snapshot or email address", async () => {
    const response = await revisionsGET(request(ownerToken), context());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.revisions[0]).toMatchObject({ version: 1, action: "created", changedBy: { displayName: "Ana" }, changes: [] });
    expect(JSON.stringify(body)).not.toContain("ana@example.com");
    expect(JSON.stringify(body)).not.toContain("snapshot");
  });

  it("404s for a non-member and a removed member", async () => {
    expect((await revisionsGET(request(outsiderToken), context())).status).toBe(404);
    await getTestDb().update(groupMembers).set({ removedAt: new Date() }).where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, memberId)));
    expect((await revisionsGET(request(memberToken), context())).status).toBe(404);
  });

  it("serializes a diff newest-first with money as wire strings, never raw integers", async () => {
    await updateExpense(expenseId, ownerId, {
      title: "Cena frente al mar",
      date: "2026-08-24",
      amount: "1500",
      currency: "USD",
      split: { strategy: "equal" },
    });

    const body = await (await revisionsGET(request(ownerToken), context())).json();
    expect(body.revisions.map((r: { version: number; action: string }) => [r.version, r.action])).toEqual([
      [2, "updated"],
      [1, "created"],
    ]);

    const changes = body.revisions[0].changes as Array<Record<string, unknown>>;
    const total = changes.find((c) => c.kind === "money") as { from: unknown; to: unknown };
    // A currency change keeps each side in its own currency, as wire money.
    expect(total.from).toEqual({ amount: "1000", currency: "COP" });
    expect(total.to).toEqual({ amount: "1500", currency: "USD" });
    expect(changes).toContainEqual({ kind: "text", field: "currency", from: "COP", to: "USD" });
    expect(JSON.stringify(body)).not.toContain("@example.com");
  });
});
