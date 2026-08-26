import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { hasTestDatabase, setupTestDb, getTestDb } from "../../test/db";
import { groupMembers, groups, users } from "../db/schema";

const DATABASE_URL_TEST = process.env.DATABASE_URL_TEST;

describe.skipIf(!hasTestDatabase)("getGroupBalances", () => {
  setupTestDb();

  let createExpense: typeof import("./expenses").createExpense;
  let deleteExpense: typeof import("./expenses").deleteExpense;
  let getGroupBalances: typeof import("./balances").getGroupBalances;
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

    ({ createExpense, deleteExpense } = await import("./expenses"));
    ({ getGroupBalances } = await import("./balances"));
    ({ NotAMemberError } = await import("../auth/membership"));
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

  it("computes net for a single expense split three ways", async () => {
    const { groupId, memberIds } = await seedGroup(3);
    await createExpense(groupId, memberIds[0]!, {
      title: "Dinner",
      date: "2026-08-24",
      amount: "9000",
      currency: "COP",
      split: { strategy: "equal" },
    });

    const balances = await getGroupBalances(groupId, memberIds[0]!);
    const cop = balances.get("COP")!;
    expect(cop.get(memberIds[0]!)!.net).toBe(6000n);
    expect(cop.get(memberIds[1]!)!.net).toBe(-3000n);
    expect(cop.get(memberIds[2]!)!.net).toBe(-3000n);
  });

  it("nets a multi-payer expense correctly", async () => {
    const { groupId, memberIds } = await seedGroup(2);
    await createExpense(groupId, memberIds[0]!, {
      title: "Hotel",
      date: "2026-08-24",
      amount: "10000",
      currency: "COP",
      paidBy: [
        { userId: memberIds[0]!, amount: "6000" },
        { userId: memberIds[1]!, amount: "4000" },
      ],
      split: { strategy: "equal" },
    });

    const balances = await getGroupBalances(groupId, memberIds[0]!);
    const cop = balances.get("COP")!;
    expect(cop.get(memberIds[0]!)!.net).toBe(1000n);
    expect(cop.get(memberIds[1]!)!.net).toBe(-1000n);
  });

  it("excludes a soft-deleted expense", async () => {
    const { groupId, memberIds } = await seedGroup(2);
    await createExpense(groupId, memberIds[0]!, {
      title: "Kept",
      date: "2026-08-24",
      amount: "2000",
      currency: "COP",
      split: { strategy: "equal" },
    });
    const deleted = await createExpense(groupId, memberIds[0]!, {
      title: "Deleted",
      date: "2026-08-23",
      amount: "8000",
      currency: "COP",
      split: { strategy: "equal" },
    });
    await deleteExpense(deleted.id, memberIds[0]!);

    const balances = await getGroupBalances(groupId, memberIds[0]!);
    const cop = balances.get("COP")!;
    // Only the kept 2000 expense should count: 1000 net for the payer.
    expect(cop.get(memberIds[0]!)!.net).toBe(1000n);
  });

  it("produces two independent position sets for a mixed-currency group", async () => {
    const { groupId, memberIds } = await seedGroup(2);
    await createExpense(groupId, memberIds[0]!, {
      title: "COP thing",
      date: "2026-08-24",
      amount: "2000",
      currency: "COP",
      split: { strategy: "equal" },
    });
    await createExpense(groupId, memberIds[1]!, {
      title: "USD thing",
      date: "2026-08-24",
      amount: "200",
      currency: "USD",
      split: { strategy: "equal" },
    });

    const balances = await getGroupBalances(groupId, memberIds[0]!);
    expect(balances.get("COP")!.get(memberIds[0]!)!.net).toBe(1000n);
    expect(balances.get("USD")!.get(memberIds[0]!)!.net).toBe(-100n);
  });

  it("404s a non-member", async () => {
    const { groupId } = await seedGroup(1);
    await expect(getGroupBalances(groupId, crypto.randomUUID())).rejects.toThrow(NotAMemberError);
  });

  it("still includes a removed member's historical rows", async () => {
    const { groupId, memberIds } = await seedGroup(2);
    await createExpense(groupId, memberIds[0]!, {
      title: "Before they left",
      date: "2026-08-24",
      amount: "2000",
      currency: "COP",
      split: { strategy: "equal" },
    });
    await getTestDb()
      .update(groupMembers)
      .set({ removedAt: new Date() })
      .where(eq(groupMembers.userId, memberIds[1]!));

    const balances = await getGroupBalances(groupId, memberIds[0]!);
    expect(balances.get("COP")!.get(memberIds[1]!)!.net).toBe(-1000n);
  });
});
