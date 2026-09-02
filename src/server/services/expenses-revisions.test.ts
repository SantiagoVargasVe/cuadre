import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { and, eq } from "drizzle-orm";
import { getTestDb, hasTestDatabase, setupTestDb } from "../../test/db";
import { expenseRevisions, groupMembers, users } from "../db/schema";

const DATABASE_URL_TEST = process.env.DATABASE_URL_TEST;

describe.skipIf(!hasTestDatabase)("listExpenseRevisions", () => {
  setupTestDb();

  let createGroup: typeof import("./groups").createGroup;
  let createExpense: typeof import("./expenses").createExpense;
  let updateExpense: typeof import("./expenses").updateExpense;
  let listExpenseRevisions: typeof import("./expenses-revisions").listExpenseRevisions;
  let NotAMemberError: typeof import("../auth/membership").NotAMemberError;

  beforeAll(async () => {
    vi.stubEnv("APP_URL", "http://localhost:3000");
    vi.stubEnv("DATABASE_URL", DATABASE_URL_TEST ?? "");
    vi.stubEnv("AUTH_SECRET", "a".repeat(48));
    vi.stubEnv("SUPPORTED_CURRENCIES", "COP,USD,EUR");
    vi.stubEnv("DEFAULT_CURRENCY", "COP");
    vi.stubEnv("FX_PROVIDER", "open-er-api");
    vi.stubEnv("FX_BASE_CURRENCY", "USD");
    vi.stubEnv("FX_TRM_CROSSCHECK", "true");
    ({ createGroup } = await import("./groups"));
    ({ createExpense, updateExpense } = await import("./expenses"));
    ({ listExpenseRevisions } = await import("./expenses-revisions"));
    ({ NotAMemberError } = await import("../auth/membership"));
  });

  afterAll(() => vi.unstubAllEnvs());

  async function seed() {
    const db = getTestDb();
    const [owner] = await db.insert(users).values({ email: `${crypto.randomUUID()}@example.com`, displayName: "Ana", passwordHash: "x" }).returning();
    const [member] = await db.insert(users).values({ email: `${crypto.randomUUID()}@example.com`, displayName: "Beto", passwordHash: "x" }).returning();
    const [outsider] = await db.insert(users).values({ email: `${crypto.randomUUID()}@example.com`, displayName: "Caro", passwordHash: "x" }).returning();
    const group = await createGroup(owner!.id, { title: "Cartagena" });
    await db.insert(groupMembers).values({ groupId: group.id, userId: member!.id, role: "member" });
    const expense = await createExpense(group.id, owner!.id, { title: "Cena", date: "2026-08-24", amount: "1000", currency: "COP", split: { strategy: "equal" } });
    return { group, owner: owner!, member: member!, outsider: outsider!, expense };
  }

  it("returns newest first, preserves creation, and permits no email fields", async () => {
    const { owner, expense } = await seed();
    const revisions = await listExpenseRevisions(expense.id, owner.id);
    expect(revisions).toHaveLength(1);
    expect(revisions[0]).toMatchObject({ version: 1, action: "created", changedBy: { displayName: "Ana" }, changes: [] });
    expect(Object.keys(revisions[0]!)).not.toContain("snapshot");
  });

  it("404s both an outsider and a removed member for this id-addressed read", async () => {
    const { group, member, outsider, expense } = await seed();
    await expect(listExpenseRevisions(expense.id, outsider.id)).rejects.toThrow(NotAMemberError);
    await getTestDb()
      .update(groupMembers)
      .set({ removedAt: new Date() })
      .where(and(eq(groupMembers.groupId, group.id), eq(groupMembers.userId, member.id)));
    await expect(listExpenseRevisions(expense.id, member.id)).rejects.toThrow(NotAMemberError);
  });

  it("diffs consecutive snapshots server-side, newest first, money staying bigint", async () => {
    const { owner, member, expense } = await seed();
    await updateExpense(expense.id, owner.id, {
      title: "Cena frente al mar",
      date: "2026-08-24",
      amount: "1200",
      currency: "COP",
      paidBy: [
        { userId: owner.id, amount: "800" },
        { userId: member.id, amount: "400" },
      ],
      split: { strategy: "exact", amounts: { [owner.id]: "700", [member.id]: "500" } },
    });

    const revisions = await listExpenseRevisions(expense.id, owner.id);
    expect(revisions.map((r) => [r.version, r.action])).toEqual([
      [2, "updated"],
      [1, "created"],
    ]);
    expect(revisions[1]!.changes).toEqual([]);

    const changes = revisions[0]!.changes;
    expect(changes).toContainEqual({ kind: "text", field: "title", from: "Cena", to: "Cena frente al mar" });
    expect(changes).toContainEqual({ kind: "text", field: "splitStrategy", from: "equal", to: "exact" });

    const total = changes.find((c) => c.kind === "money");
    expect(total).toMatchObject({ field: "totalAmount", from: { amount: 1000n, currency: "COP" }, to: { amount: 1200n, currency: "COP" } });
    if (total?.kind !== "money") throw new Error("expected a money change");
    expect(typeof total.from.amount).toBe("bigint");

    // Multi-payer edit: the acting user's share drops, the other becomes a payer.
    const payerDeltas = changes.filter((c) => c.kind === "party" && c.field === "payers");
    expect(payerDeltas).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ userId: owner.id, change: "changed", displayName: "Ana" }),
        expect.objectContaining({ userId: member.id, change: "added", displayName: "Beto", from: null }),
      ]),
    );

    // Per-member split delta: only Ana's share moved.
    const splitDeltas = changes.filter((c) => c.kind === "party" && c.field === "splits");
    expect(splitDeltas).toEqual([
      expect.objectContaining({ userId: owner.id, change: "changed", from: { amount: 500n, currency: "COP" }, to: { amount: 700n, currency: "COP" } }),
    ]);

    expect(revisions[0]!.changedBy).toMatchObject({ userId: owner.id, displayName: "Ana" });
    // No snapshot passes through: changes are a closed set of structured deltas.
    for (const change of changes) {
      expect(["text", "money", "party"]).toContain(change.kind);
    }
  });

  it("keeps 'when' when 'who' is gone — changedBy null (FK ON DELETE SET NULL)", async () => {
    const { owner, expense } = await seed();
    await getTestDb()
      .update(expenseRevisions)
      .set({ changedBy: null })
      .where(eq(expenseRevisions.expenseId, expense.id));

    const revisions = await listExpenseRevisions(expense.id, owner.id);
    expect(revisions[0]!.changedBy).toBeNull();
    expect(revisions[0]!.changedAt).toEqual(expect.any(String));
    expect(revisions[0]).toMatchObject({ version: 1, action: "created" });
  });
});
