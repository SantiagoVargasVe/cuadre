import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { hasTestDatabase, setupTestDb, getTestDb } from "../../test/db";
import { groupMembers, groups, users } from "../db/schema";

const DATABASE_URL_TEST = process.env.DATABASE_URL_TEST;

describe.skipIf(!hasTestDatabase)("settlements service", () => {
  setupTestDb();

  let createSettlement: typeof import("./settlements").createSettlement;
  let updateSettlement: typeof import("./settlements").updateSettlement;
  let deleteSettlement: typeof import("./settlements").deleteSettlement;
  let listSettlements: typeof import("./settlements").listSettlements;
  let NotAGroupMemberOnSettlementError: typeof import("./settlements").NotAGroupMemberOnSettlementError;
  let SettlementRequiresDistinctPartiesError: typeof import("./settlements").SettlementRequiresDistinctPartiesError;
  let getGroupBalances: typeof import("./balances").getGroupBalances;
  let createExpense: typeof import("./expenses").createExpense;
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

    ({
      createSettlement,
      updateSettlement,
      deleteSettlement,
      listSettlements,
      NotAGroupMemberOnSettlementError,
      SettlementRequiresDistinctPartiesError,
    } = await import("./settlements"));
    ({ getGroupBalances } = await import("./balances"));
    ({ createExpense } = await import("./expenses"));
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

  it("records a settlement with fromUserId as the acting user", async () => {
    const { groupId, memberIds } = await seedGroup(2);
    const [ana, beto] = memberIds;

    const result = await createSettlement(groupId, beto!, {
      toUserId: ana!,
      amount: "5000",
      currency: "COP",
      settledOn: "2026-08-24",
    });

    expect(result.fromUserId).toBe(beto);
    expect(result.toUserId).toBe(ana);
    expect(result.amount).toBe("5000");
  });

  it("rejects a settlement to a non-member", async () => {
    const { groupId, memberIds } = await seedGroup(1);
    const db = getTestDb();
    const [outsider] = await db
      .insert(users)
      .values({ email: `${crypto.randomUUID()}@example.com`, displayName: "Fuera", passwordHash: "x" })
      .returning();

    await expect(
      createSettlement(groupId, memberIds[0]!, {
        toUserId: outsider!.id,
        amount: "1000",
        currency: "COP",
        settledOn: "2026-08-24",
      }),
    ).rejects.toThrow(NotAGroupMemberOnSettlementError);
  });

  it("rejects a settlement with the same member on both sides", async () => {
    const { groupId, memberIds } = await seedGroup(1);

    await expect(
      createSettlement(groupId, memberIds[0]!, {
        toUserId: memberIds[0]!,
        amount: "1000",
        currency: "COP",
        settledOn: "2026-08-24",
      }),
    ).rejects.toThrow(SettlementRequiresDistinctPartiesError);
  });

  it("rejects createSettlement for a non-member of the group", async () => {
    const { groupId } = await seedGroup(1);
    const db = getTestDb();
    const [outsider] = await db
      .insert(users)
      .values({ email: `${crypto.randomUUID()}@example.com`, displayName: "Fuera", passwordHash: "x" })
      .returning();

    await expect(
      createSettlement(groupId, outsider!.id, {
        toUserId: outsider!.id,
        amount: "1000",
        currency: "COP",
        settledOn: "2026-08-24",
      }),
    ).rejects.toThrow(NotAMemberError);
  });

  it("clears a debt exactly, overshoots flip the sign, and a delete reverts the effect", async () => {
    const { groupId, memberIds } = await seedGroup(2);
    const [ana, beto] = memberIds as [string, string];

    // Ana pays 10000, split evenly: Beto owes Ana 5000.
    await createExpense(groupId, ana, {
      title: "Dinner",
      date: "2026-08-24",
      amount: "10000",
      currency: "COP",
      split: { strategy: "equal" },
    });

    const before = await getGroupBalances(groupId, ana);
    expect(before.get("COP")!.get(beto)!.net).toBe(-5000n);
    expect(before.get("COP")!.get(ana)!.net).toBe(5000n);

    // Exact settlement clears it.
    const exact = await createSettlement(groupId, beto, {
      toUserId: ana,
      amount: "5000",
      currency: "COP",
      settledOn: "2026-08-24",
    });
    const afterExact = await getGroupBalances(groupId, ana);
    expect(afterExact.get("COP")!.get(beto)!.net).toBe(0n);
    expect(afterExact.get("COP")!.get(ana)!.net).toBe(0n);

    // Deleting it reverts to the pre-settlement position.
    await deleteSettlement(exact.id, beto);
    const afterDelete = await getGroupBalances(groupId, ana);
    expect(afterDelete.get("COP")!.get(beto)!.net).toBe(-5000n);
    expect(afterDelete.get("COP")!.get(ana)!.net).toBe(5000n);

    // Overshooting by 3000 flips the sign the other way.
    await createSettlement(groupId, beto, {
      toUserId: ana,
      amount: "8000",
      currency: "COP",
      settledOn: "2026-08-24",
    });
    const afterOvershoot = await getGroupBalances(groupId, ana);
    expect(afterOvershoot.get("COP")!.get(beto)!.net).toBe(3000n);
    expect(afterOvershoot.get("COP")!.get(ana)!.net).toBe(-3000n);
  });

  it("moves net identically regardless of whether the group displays raw or simplified debts", async () => {
    // Net balances (what a settlement actually moves) are computed purely
    // from paid/owed/sent/received — the simplify toggle only changes how
    // that same net is *presented* (T041's pairwise view vs. T042's
    // simplified plan), never what it *is*. This settles the debt exactly
    // and checks that both derived views agree there's nothing left.
    const { groupId, memberIds } = await seedGroup(2);
    const [ana, beto] = memberIds as [string, string];

    await createExpense(groupId, ana, {
      title: "Dinner",
      date: "2026-08-24",
      amount: "10000",
      currency: "COP",
      split: { strategy: "equal" },
    });
    await createSettlement(groupId, beto, {
      toUserId: ana,
      amount: "5000",
      currency: "COP",
      settledOn: "2026-08-24",
    });

    const balances = await getGroupBalances(groupId, ana);
    const net = balances.get("COP")!;
    expect(net.get(ana)!.net).toBe(0n);
    expect(net.get(beto)!.net).toBe(0n);

    const { simplify } = await import("../../lib/money/simplify");
    const netMap = new Map([...net].map(([memberId, balance]) => [memberId, balance.net]));
    expect(simplify(netMap)).toEqual([]);
  });

  it("PATCH replaces every field except fromUserId", async () => {
    const { groupId, memberIds } = await seedGroup(2);
    const [ana, beto] = memberIds as [string, string];

    const created = await createSettlement(groupId, beto, {
      toUserId: ana,
      amount: "1000",
      currency: "COP",
      settledOn: "2026-08-24",
      note: "first",
    });

    const updated = await updateSettlement(created.id, ana, {
      toUserId: ana,
      amount: "2000",
      currency: "COP",
      settledOn: "2026-08-25",
      note: "corrected",
    });

    expect(updated.fromUserId).toBe(beto);
    expect(updated.amount).toBe("2000");
    expect(updated.settledOn).toBe("2026-08-25");
    expect(updated.note).toBe("corrected");
  });

  it("PATCH omitting note clears an existing one, not silently keeps it", async () => {
    const { groupId, memberIds } = await seedGroup(2);
    const [ana, beto] = memberIds as [string, string];

    const created = await createSettlement(groupId, beto, {
      toUserId: ana,
      amount: "1000",
      currency: "COP",
      settledOn: "2026-08-24",
      note: "will be cleared",
    });

    const updated = await updateSettlement(created.id, ana, {
      toUserId: ana,
      amount: "1000",
      currency: "COP",
      settledOn: "2026-08-24",
    });

    expect(updated.note).toBeNull();
  });

  it("lists settlements newest-first with a working cursor", async () => {
    const { groupId, memberIds } = await seedGroup(2);
    const [ana, beto] = memberIds as [string, string];

    for (const date of ["2026-08-20", "2026-08-21", "2026-08-22"]) {
      await createSettlement(groupId, beto, {
        toUserId: ana,
        amount: "1000",
        currency: "COP",
        settledOn: date,
      });
    }

    const firstPage = await listSettlements(groupId, ana, { limit: 2 });
    expect(firstPage.items).toHaveLength(2);
    expect(firstPage.items[0]!.settledOn).toBe("2026-08-22");
    expect(firstPage.nextCursor).not.toBeNull();

    const secondPage = await listSettlements(groupId, ana, { cursor: firstPage.nextCursor! });
    expect(secondPage.items).toHaveLength(1);
    expect(secondPage.items[0]!.settledOn).toBe("2026-08-20");
    expect(secondPage.nextCursor).toBeNull();
  });
});
