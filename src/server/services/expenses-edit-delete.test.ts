import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { hasTestDatabase, setupTestDb, getTestDb } from "../../test/db";
import {
  expensePayers,
  expenseRevisions,
  expenses,
  expenseSplits,
  groupMembers,
  groups,
  users,
} from "../db/schema";

const DATABASE_URL_TEST = process.env.DATABASE_URL_TEST;

describe.skipIf(!hasTestDatabase)("updateExpense / deleteExpense", () => {
  setupTestDb();

  let createExpense: typeof import("./expenses").createExpense;
  let updateExpense: typeof import("./expenses").updateExpense;
  let deleteExpense: typeof import("./expenses").deleteExpense;
  let liveExpenses: typeof import("../db/helpers").liveExpenses;
  let NotAMemberError: typeof import("../auth/membership").NotAMemberError;
  let GroupArchivedError: typeof import("../auth/membership").GroupArchivedError;

  beforeAll(async () => {
    vi.stubEnv("APP_URL", "http://localhost:3000");
    vi.stubEnv("DATABASE_URL", DATABASE_URL_TEST ?? "");
    vi.stubEnv("AUTH_SECRET", "a".repeat(48));
    vi.stubEnv("SUPPORTED_CURRENCIES", "COP,USD,EUR");
    vi.stubEnv("DEFAULT_CURRENCY", "COP");
    vi.stubEnv("FX_PROVIDER", "open-er-api");
    vi.stubEnv("FX_BASE_CURRENCY", "USD");
    vi.stubEnv("FX_TRM_CROSSCHECK", "true");

    ({ createExpense, updateExpense, deleteExpense } = await import("./expenses"));
    ({ liveExpenses } = await import("../db/helpers"));
    ({ NotAMemberError, GroupArchivedError } = await import("../auth/membership"));
  });

  afterAll(() => vi.unstubAllEnvs());

  async function seedGroup(memberCount: number) {
    const db = getTestDb();
    const memberIds: string[] = [];
    for (let i = 0; i < memberCount; i++) {
      const [user] = await db
        .insert(users)
        .values({ email: `${crypto.randomUUID()}@example.com`, displayName: `M${i}`, passwordHash: "x" })
        .returning();
      memberIds.push(user!.id);
    }
    const [group] = await db
      .insert(groups)
      .values({ title: "Trip", defaultCurrency: "COP", createdBy: memberIds[0] })
      .returning();
    for (const userId of memberIds) {
      await db
        .insert(groupMembers)
        .values({ groupId: group!.id, userId, role: userId === memberIds[0] ? "owner" : "member" });
    }
    return { groupId: group!.id, memberIds };
  }

  describe("updateExpense", () => {
    it("replaces the expense, bumps version, and writes a complete 'updated' snapshot", async () => {
      const { groupId, memberIds } = await seedGroup(2);
      const created = await createExpense(groupId, memberIds[0]!, {
        title: "Dinner",
        date: "2026-08-24",
        amount: "1000",
        currency: "COP",
        split: { strategy: "equal" },
      });

      const updated = await updateExpense(created.id, memberIds[1]!, {
        title: "Dinner (corrected)",
        date: "2026-08-25",
        amount: "2000",
        currency: "COP",
        split: { strategy: "exact", amounts: { [memberIds[0]!]: "1200", [memberIds[1]!]: "800" } },
      });

      expect(updated.version).toBe(2);
      expect(updated.total).toEqual({ amount: "2000", currency: "COP" });
      expect(updated.editedAt).not.toBeNull();

      const [revision] = await getTestDb()
        .select()
        .from(expenseRevisions)
        .where(eq(expenseRevisions.version, 2));
      expect(revision?.action).toBe("updated");
      expect(revision?.snapshot).toMatchObject({
        title: "Dinner (corrected)",
        totalAmount: "2000",
        splits: expect.arrayContaining([
          { userId: memberIds[0], amount: "1200" },
          { userId: memberIds[1], amount: "800" },
        ]),
      });
    });

    it("any member may edit, not just the creator", async () => {
      const { groupId, memberIds } = await seedGroup(2);
      const created = await createExpense(groupId, memberIds[0]!, {
        title: "Original",
        date: "2026-08-24",
        amount: "1000",
        currency: "COP",
        split: { strategy: "equal" },
      });

      await expect(
        updateExpense(created.id, memberIds[1]!, {
          title: "Edited by someone else",
          date: "2026-08-24",
          amount: "1000",
          currency: "COP",
          split: { strategy: "equal" },
        }),
      ).resolves.toMatchObject({ version: 2 });
    });

    it("replaces payer and split rows entirely — nothing from the old set survives", async () => {
      const { groupId, memberIds } = await seedGroup(2);
      const created = await createExpense(groupId, memberIds[0]!, {
        title: "Dinner",
        date: "2026-08-24",
        amount: "1000",
        currency: "COP",
        split: { strategy: "equal" },
      });

      await updateExpense(created.id, memberIds[0]!, {
        title: "Dinner",
        date: "2026-08-24",
        amount: "1000",
        currency: "COP",
        split: { strategy: "loan", to: memberIds[1]! },
      });

      const splits = await getTestDb()
        .select()
        .from(expenseSplits)
        .where(eq(expenseSplits.expenseId, created.id));
      const payers = await getTestDb()
        .select()
        .from(expensePayers)
        .where(eq(expensePayers.expenseId, created.id));
      expect(splits).toEqual([expect.objectContaining({ userId: memberIds[1], amount: 1000n })]);
      expect(payers).toEqual([expect.objectContaining({ userId: memberIds[0], amount: 1000n })]);
    });

    it("re-resolution is stable across an unrelated title edit: same seed, same rotation", async () => {
      const { groupId, memberIds } = await seedGroup(3);
      const created = await createExpense(groupId, memberIds[0]!, {
        title: "Dinner",
        date: "2026-08-24",
        amount: "10000000",
        currency: "COP",
        split: { strategy: "equal" },
      });
      const before = new Map(created.splits.map((s) => [s.userId, s.amount]));

      const updated = await updateExpense(created.id, memberIds[0]!, {
        title: "Dinner (renamed only)",
        date: "2026-08-24",
        amount: "10000000",
        currency: "COP",
        split: { strategy: "equal" },
      });
      const after = new Map(updated.splits.map((s) => [s.userId, s.amount]));

      expect(after).toEqual(before);
    });

    it("throws NotAMemberError (404) for a non-member — the id-addressed case", async () => {
      const { groupId, memberIds } = await seedGroup(1);
      const created = await createExpense(groupId, memberIds[0]!, {
        title: "Dinner",
        date: "2026-08-24",
        amount: "1000",
        currency: "COP",
        split: { strategy: "equal" },
      });

      await expect(
        updateExpense(created.id, crypto.randomUUID(), {
          title: "Hijack attempt",
          date: "2026-08-24",
          amount: "1000",
          currency: "COP",
          split: { strategy: "equal" },
        }),
      ).rejects.toThrow(NotAMemberError);
    });

    it("throws NotAMemberError for an id that doesn't exist at all", async () => {
      const { memberIds } = await seedGroup(1);
      await expect(
        updateExpense(crypto.randomUUID(), memberIds[0]!, {
          title: "Nope",
          date: "2026-08-24",
          amount: "1000",
          currency: "COP",
          split: { strategy: "equal" },
        }),
      ).rejects.toThrow(NotAMemberError);
    });

    it("refuses to edit in an archived group", async () => {
      const { groupId, memberIds } = await seedGroup(1);
      const created = await createExpense(groupId, memberIds[0]!, {
        title: "Dinner",
        date: "2026-08-24",
        amount: "1000",
        currency: "COP",
        split: { strategy: "equal" },
      });
      await getTestDb().update(groups).set({ archivedAt: new Date() }).where(eq(groups.id, groupId));

      await expect(
        updateExpense(created.id, memberIds[0]!, {
          title: "Too late",
          date: "2026-08-24",
          amount: "1000",
          currency: "COP",
          split: { strategy: "equal" },
        }),
      ).rejects.toThrow(GroupArchivedError);
    });
  });

  describe("deleteExpense", () => {
    it("soft-deletes: sets deleted_at, writes a 'deleted' revision, keeps payer/split rows", async () => {
      const { groupId, memberIds } = await seedGroup(1);
      const created = await createExpense(groupId, memberIds[0]!, {
        title: "Dinner",
        date: "2026-08-24",
        amount: "1000",
        currency: "COP",
        split: { strategy: "equal" },
      });

      await deleteExpense(created.id, memberIds[0]!);

      const [expense] = await getTestDb().select().from(expenses).where(eq(expenses.id, created.id));
      expect(expense?.deletedAt).toBeInstanceOf(Date);

      const revisions = await getTestDb()
        .select()
        .from(expenseRevisions)
        .where(eq(expenseRevisions.expenseId, created.id));
      expect(revisions.map((r) => r.action)).toEqual(["created", "deleted"]);

      const splits = await getTestDb()
        .select()
        .from(expenseSplits)
        .where(eq(expenseSplits.expenseId, created.id));
      expect(splits).toHaveLength(1);
    });

    it("vanishes from liveExpenses while its revisions survive", async () => {
      const { groupId, memberIds } = await seedGroup(1);
      const created = await createExpense(groupId, memberIds[0]!, {
        title: "Dinner",
        date: "2026-08-24",
        amount: "1000",
        currency: "COP",
        split: { strategy: "equal" },
      });

      await deleteExpense(created.id, memberIds[0]!);

      expect(await liveExpenses(groupId)).toEqual([]);
      const revisions = await getTestDb()
        .select()
        .from(expenseRevisions)
        .where(eq(expenseRevisions.expenseId, created.id));
      expect(revisions).toHaveLength(2);
    });

    it("404s for a non-member", async () => {
      const { groupId, memberIds } = await seedGroup(1);
      const created = await createExpense(groupId, memberIds[0]!, {
        title: "Dinner",
        date: "2026-08-24",
        amount: "1000",
        currency: "COP",
        split: { strategy: "equal" },
      });

      await expect(deleteExpense(created.id, crypto.randomUUID())).rejects.toThrow(NotAMemberError);
    });

    it("refuses to delete in an archived group", async () => {
      const { groupId, memberIds } = await seedGroup(1);
      const created = await createExpense(groupId, memberIds[0]!, {
        title: "Dinner",
        date: "2026-08-24",
        amount: "1000",
        currency: "COP",
        split: { strategy: "equal" },
      });
      await getTestDb().update(groups).set({ archivedAt: new Date() }).where(eq(groups.id, groupId));

      await expect(deleteExpense(created.id, memberIds[0]!)).rejects.toThrow(GroupArchivedError);
    });
  });
});
