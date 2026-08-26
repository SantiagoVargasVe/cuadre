import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { hasTestDatabase, setupTestDb, getTestDb } from "../../test/db";
import { expensePayers, expenseSplits, expenses, groupMembers, groups, users } from "./schema";

const DATABASE_URL_TEST = process.env.DATABASE_URL_TEST;

describe.skipIf(!hasTestDatabase)("expenses ledger schema", () => {
  setupTestDb();

  let liveExpenses: typeof import("./helpers").liveExpenses;

  beforeAll(async () => {
    // helpers.ts imports the pooled `db` singleton, which validates the
    // full app config at import time — same reason as every other
    // dynamic-import-after-stubbing test file in this repo.
    vi.stubEnv("APP_URL", "http://localhost:3000");
    vi.stubEnv("DATABASE_URL", DATABASE_URL_TEST ?? "");
    vi.stubEnv("AUTH_SECRET", "a".repeat(48));
    vi.stubEnv("SUPPORTED_CURRENCIES", "COP,USD,EUR");
    vi.stubEnv("DEFAULT_CURRENCY", "COP");
    vi.stubEnv("FX_PROVIDER", "open-er-api");
    vi.stubEnv("FX_BASE_CURRENCY", "USD");
    vi.stubEnv("FX_TRM_CROSSCHECK", "true");

    ({ liveExpenses } = await import("./helpers"));
  });

  afterAll(() => vi.unstubAllEnvs());

  async function seedGroupWithOwner() {
    const db = getTestDb();
    const [owner] = await db
      .insert(users)
      .values({ email: `${crypto.randomUUID()}@example.com`, displayName: "Ana", passwordHash: "x" })
      .returning();
    const [group] = await db
      .insert(groups)
      .values({ title: "Trip", defaultCurrency: "COP", createdBy: owner!.id })
      .returning();
    await db.insert(groupMembers).values({ groupId: group!.id, userId: owner!.id, role: "owner" });
    return { ownerId: owner!.id, groupId: group!.id };
  }

  /**
   * The deferred trigger fires on every insert to `expenses`, even one
   * with no matching payer/split rows — a standalone `db.insert(expenses)`
   * call is its own implicit transaction, so "deferred to commit" still
   * means "immediately," and it fails the same as an unbalanced explicit
   * transaction would. Tests that just need *some* existing expense row
   * (to attach an invalid child row to, or to read back via liveExpenses)
   * go through this helper instead of inserting the parent alone.
   */
  async function createBalancedExpense(
    groupId: string,
    ownerId: string,
    overrides: Partial<{ title: string; expenseDate: string; totalAmount: bigint; deletedAt: Date }> = {},
  ) {
    const totalAmount = overrides.totalAmount ?? 100n;
    return getTestDb().transaction(async (tx) => {
      const [expense] = await tx
        .insert(expenses)
        .values({
          groupId,
          title: "Expense",
          expenseDate: "2026-08-24",
          currency: "COP",
          splitStrategy: "equal",
          createdBy: ownerId,
          ...overrides,
          totalAmount,
        })
        .returning();
      await tx
        .insert(expensePayers)
        .values({ expenseId: expense!.id, groupId, userId: ownerId, amount: totalAmount });
      await tx
        .insert(expenseSplits)
        .values({ expenseId: expense!.id, groupId, userId: ownerId, amount: totalAmount });
      return expense!;
    });
  }

  it("commits a balanced expense: payers, splits, and total all agree", async () => {
    const { ownerId, groupId } = await seedGroupWithOwner();
    const db = getTestDb();

    await db.transaction(async (tx) => {
      const [expense] = await tx
        .insert(expenses)
        .values({
          groupId,
          title: "Dinner",
          expenseDate: "2026-08-24",
          totalAmount: 10000n,
          currency: "COP",
          splitStrategy: "equal",
          createdBy: ownerId,
        })
        .returning();
      await tx.insert(expensePayers).values({
        expenseId: expense!.id,
        groupId,
        userId: ownerId,
        amount: 10000n,
      });
      await tx.insert(expenseSplits).values({
        expenseId: expense!.id,
        groupId,
        userId: ownerId,
        amount: 10000n,
      });
    });

    const rows = await getTestDb().select().from(expenses).where(eq(expenses.groupId, groupId));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.totalAmount).toBe(10000n);
  });

  it("aborts the whole transaction when splits don't sum to the total — service bypassed", async () => {
    const { ownerId, groupId } = await seedGroupWithOwner();
    const db = getTestDb();

    const attempt = db.transaction(async (tx) => {
      const [expense] = await tx
        .insert(expenses)
        .values({
          groupId,
          title: "Broken",
          expenseDate: "2026-08-24",
          totalAmount: 10000n,
          currency: "COP",
          splitStrategy: "equal",
          createdBy: ownerId,
        })
        .returning();
      await tx.insert(expensePayers).values({
        expenseId: expense!.id,
        groupId,
        userId: ownerId,
        amount: 10000n,
      });
      // One unit short — the deferred trigger must catch this at commit,
      // not the insert itself, since the payer row above is otherwise fine.
      await tx.insert(expenseSplits).values({
        expenseId: expense!.id,
        groupId,
        userId: ownerId,
        amount: 9999n,
      });
    });

    await expect(attempt).rejects.toThrow(/Unbalanced expense/);
    expect(
      await getTestDb().select().from(expenses).where(eq(expenses.groupId, groupId)),
    ).toHaveLength(0);
  });

  it("aborts when payers don't sum to the total either", async () => {
    const { ownerId, groupId } = await seedGroupWithOwner();
    const db = getTestDb();

    const attempt = db.transaction(async (tx) => {
      const [expense] = await tx
        .insert(expenses)
        .values({
          groupId,
          title: "Broken payer",
          expenseDate: "2026-08-24",
          totalAmount: 10000n,
          currency: "COP",
          splitStrategy: "equal",
          createdBy: ownerId,
        })
        .returning();
      await tx.insert(expensePayers).values({
        expenseId: expense!.id,
        groupId,
        userId: ownerId,
        amount: 5000n,
      });
      await tx.insert(expenseSplits).values({
        expenseId: expense!.id,
        groupId,
        userId: ownerId,
        amount: 10000n,
      });
    });

    await expect(attempt).rejects.toThrow(/Unbalanced expense/);
  });

  it("rejects a split naming a non-member, via the composite FK to group_members", async () => {
    const { ownerId, groupId } = await seedGroupWithOwner();
    const [outsider] = await getTestDb()
      .insert(users)
      .values({ email: `${crypto.randomUUID()}@example.com`, displayName: "Nadie", passwordHash: "x" })
      .returning();

    const attempt = getTestDb().transaction(async (tx) => {
      const [expense] = await tx
        .insert(expenses)
        .values({
          groupId,
          title: "Outsider",
          expenseDate: "2026-08-24",
          totalAmount: 10000n,
          currency: "COP",
          splitStrategy: "equal",
          createdBy: ownerId,
        })
        .returning();
      await tx.insert(expensePayers).values({
        expenseId: expense!.id,
        groupId,
        userId: ownerId,
        amount: 10000n,
      });
      await tx.insert(expenseSplits).values({
        expenseId: expense!.id,
        groupId,
        userId: outsider!.id,
        amount: 10000n,
      });
    });

    await expect(attempt).rejects.toThrow();
  });

  it("rejects a non-positive total_amount", async () => {
    const { ownerId, groupId } = await seedGroupWithOwner();
    await expect(
      getTestDb().insert(expenses).values({
        groupId,
        title: "Free",
        expenseDate: "2026-08-24",
        totalAmount: 0n,
        currency: "COP",
        splitStrategy: "equal",
        createdBy: ownerId,
      }),
    ).rejects.toThrow();
  });

  it("rejects a non-positive split or payer amount", async () => {
    const { ownerId, groupId } = await seedGroupWithOwner();
    const db = getTestDb();

    // Each attempt inserts the parent expense and the bad child row in one
    // transaction: the CHECK constraint on the child rejects it immediately,
    // synchronously, at that INSERT — well before the deferred balance
    // trigger would even get a chance to run at commit.
    await expect(
      db.transaction(async (tx) => {
        const [expense] = await tx
          .insert(expenses)
          .values({
            groupId,
            title: "Bad split",
            expenseDate: "2026-08-24",
            totalAmount: 10000n,
            currency: "COP",
            splitStrategy: "equal",
            createdBy: ownerId,
          })
          .returning();
        await tx
          .insert(expenseSplits)
          .values({ expenseId: expense!.id, groupId, userId: ownerId, amount: 0n });
      }),
    ).rejects.toThrow();

    await expect(
      db.transaction(async (tx) => {
        const [expense] = await tx
          .insert(expenses)
          .values({
            groupId,
            title: "Bad payer",
            expenseDate: "2026-08-24",
            totalAmount: 10000n,
            currency: "COP",
            splitStrategy: "equal",
            createdBy: ownerId,
          })
          .returning();
        await tx
          .insert(expensePayers)
          .values({ expenseId: expense!.id, groupId, userId: ownerId, amount: -1n });
      }),
    ).rejects.toThrow();
  });

  it("rejects a split_strategy outside the six known values", async () => {
    const { ownerId, groupId } = await seedGroupWithOwner();
    await expect(
      getTestDb()
        .insert(expenses)
        // @ts-expect-error splitStrategy is deliberately invalid, to prove the enum rejects it at the DB
        .values({
          groupId,
          title: "Bad strategy",
          expenseDate: "2026-08-24",
          totalAmount: 10000n,
          currency: "COP",
          splitStrategy: "made_up",
          createdBy: ownerId,
        }),
    ).rejects.toThrow();
  });

  describe("liveExpenses", () => {
    it("excludes soft-deleted expenses", async () => {
      const { ownerId, groupId } = await seedGroupWithOwner();
      const live = await createBalancedExpense(groupId, ownerId, { title: "Live" });
      const deleted = await createBalancedExpense(groupId, ownerId, {
        title: "Deleted",
        deletedAt: new Date(),
      });

      const results = await liveExpenses(groupId);

      expect(results.map((e) => e.id)).toEqual([live.id]);
      expect(results.map((e) => e.id)).not.toContain(deleted.id);
    });

    it("orders by expense_date descending", async () => {
      const { ownerId, groupId } = await seedGroupWithOwner();
      const older = await createBalancedExpense(groupId, ownerId, { expenseDate: "2026-08-01" });
      const newer = await createBalancedExpense(groupId, ownerId, { expenseDate: "2026-08-20" });

      const results = await liveExpenses(groupId);
      expect(results.map((e) => e.id)).toEqual([newer.id, older.id]);
    });
  });
});
