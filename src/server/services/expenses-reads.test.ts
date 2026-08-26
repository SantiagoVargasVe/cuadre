import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { hasTestDatabase, setupTestDb, getTestDb } from "../../test/db";
import { groupMembers, groups, users } from "../db/schema";

const DATABASE_URL_TEST = process.env.DATABASE_URL_TEST;

describe.skipIf(!hasTestDatabase)("listExpenses / getExpense", () => {
  setupTestDb();

  let createExpense: typeof import("./expenses").createExpense;
  let updateExpense: typeof import("./expenses").updateExpense;
  let deleteExpense: typeof import("./expenses").deleteExpense;
  let listExpenses: typeof import("./expenses").listExpenses;
  let getExpense: typeof import("./expenses").getExpense;
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

    ({ createExpense, updateExpense, deleteExpense, listExpenses, getExpense } =
      await import("./expenses"));
    ({ NotAMemberError } = await import("../auth/membership"));
  });

  afterAll(() => vi.unstubAllEnvs());

  async function seedGroup(memberCount: number, displayNames: string[] = []) {
    const db = getTestDb();
    const memberIds: string[] = [];
    for (let i = 0; i < memberCount; i++) {
      const [user] = await db
        .insert(users)
        .values({
          email: `${crypto.randomUUID()}@example.com`,
          displayName: displayNames[i] ?? `M${i}`,
          passwordHash: "x",
        })
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

  async function seedExpense(groupId: string, actorId: string, date: string, amount = "1000") {
    return createExpense(groupId, actorId, {
      title: `Expense ${date}`,
      date,
      amount,
      currency: "COP",
      split: { strategy: "equal" },
    });
  }

  describe("listExpenses", () => {
    it("orders by expense_date descending", async () => {
      const { groupId, memberIds } = await seedGroup(1);
      await seedExpense(groupId, memberIds[0]!, "2026-08-01");
      const middle = await seedExpense(groupId, memberIds[0]!, "2026-08-15");
      const newest = await seedExpense(groupId, memberIds[0]!, "2026-08-24");

      const result = await listExpenses(groupId, memberIds[0]!, {});
      expect(result.items[0]?.id).toBe(newest.id);
      expect(result.items[1]?.id).toBe(middle.id);
      expect(result.nextCursor).toBeNull();
    });

    it("carries payers and splits with display names", async () => {
      const { groupId, memberIds } = await seedGroup(2, ["Ana", "Beto"]);
      const created = await createExpense(groupId, memberIds[0]!, {
        title: "Dinner",
        date: "2026-08-24",
        amount: "1000",
        currency: "COP",
        split: { strategy: "equal" },
      });

      const result = await listExpenses(groupId, memberIds[0]!, {});
      const item = result.items.find((i) => i.id === created.id);
      expect(item?.payers).toEqual([{ userId: memberIds[0], displayName: "Ana", amount: "1000" }]);
      expect(item?.splits.map((s) => s.displayName).sort()).toEqual(["Ana", "Beto"]);
    });

    it("excludes soft-deleted expenses", async () => {
      const { groupId, memberIds } = await seedGroup(1);
      const kept = await seedExpense(groupId, memberIds[0]!, "2026-08-24");
      const deleted = await seedExpense(groupId, memberIds[0]!, "2026-08-23");
      await deleteExpense(deleted.id, memberIds[0]!);

      const result = await listExpenses(groupId, memberIds[0]!, {});
      expect(result.items.map((i) => i.id)).toEqual([kept.id]);
    });

    it("paginates stably across several same-day expenses: no duplicates, no gaps", async () => {
      const { groupId, memberIds } = await seedGroup(1);
      for (let i = 0; i < 5; i++) {
        await seedExpense(groupId, memberIds[0]!, "2026-08-24");
      }

      const full = await listExpenses(groupId, memberIds[0]!, { limit: 50 });
      expect(full.items).toHaveLength(5);

      const paginatedIds: string[] = [];
      let cursor: string | undefined;
      for (let guard = 0; guard < 10; guard++) {
        const page = await listExpenses(groupId, memberIds[0]!, { cursor, limit: 2 });
        paginatedIds.push(...page.items.map((i) => i.id));
        if (!page.nextCursor) break;
        cursor = page.nextCursor;
      }

      expect(paginatedIds).toEqual(full.items.map((i) => i.id));
      expect(new Set(paginatedIds).size).toBe(5);
      expect(paginatedIds).toHaveLength(5);
    });

    it("404s a non-member", async () => {
      const { groupId } = await seedGroup(1);
      await expect(listExpenses(groupId, crypto.randomUUID(), {})).rejects.toThrow(NotAMemberError);
    });
  });

  describe("getExpense", () => {
    it("returns the detail shape with version and editedAt", async () => {
      const { groupId, memberIds } = await seedGroup(1);
      const created = await seedExpense(groupId, memberIds[0]!, "2026-08-24");

      const detail = await getExpense(created.id, memberIds[0]!);
      expect(detail.version).toBe(1);
      expect(detail.editedAt).toBeNull();
      expect(detail.total).toEqual({ amount: "1000", currency: "COP" });
    });

    it("sets editedAt once the expense has been updated", async () => {
      const { groupId, memberIds } = await seedGroup(1);
      const created = await seedExpense(groupId, memberIds[0]!, "2026-08-24");
      await updateExpense(created.id, memberIds[0]!, {
        title: "Renamed",
        date: "2026-08-24",
        amount: "1000",
        currency: "COP",
        split: { strategy: "equal" },
      });

      const detail = await getExpense(created.id, memberIds[0]!);
      expect(detail.version).toBe(2);
      expect(detail.editedAt).not.toBeNull();
    });

    it("treats a soft-deleted expense as not found", async () => {
      const { groupId, memberIds } = await seedGroup(1);
      const created = await seedExpense(groupId, memberIds[0]!, "2026-08-24");
      await deleteExpense(created.id, memberIds[0]!);

      await expect(getExpense(created.id, memberIds[0]!)).rejects.toThrow(NotAMemberError);
    });

    it("404s a non-member — the id-addressed case", async () => {
      const { groupId, memberIds } = await seedGroup(1);
      const created = await seedExpense(groupId, memberIds[0]!, "2026-08-24");

      await expect(getExpense(created.id, crypto.randomUUID())).rejects.toThrow(NotAMemberError);
    });
  });
});
