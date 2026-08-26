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

describe.skipIf(!hasTestDatabase)("getBalancesView", () => {
  setupTestDb();

  let createGroup: typeof import("./groups").createGroup;
  let createExpense: typeof import("./expenses").createExpense;
  let createSettlement: typeof import("./settlements").createSettlement;
  let updateGroup: typeof import("./groups").updateGroup;
  let getBalancesView: typeof import("./balances").getBalancesView;
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
    ({ createExpense } = await import("./expenses"));
    ({ createSettlement } = await import("./settlements"));
    ({ updateGroup } = await import("./groups"));
    ({ getBalancesView } = await import("./balances"));
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
    const group = await createGroup(memberIds[0]!, { title: "Trip" });
    for (const userId of memberIds.slice(1)) {
      await db.insert(groupMembers).values({ groupId: group.id, userId, role: "member" });
    }
    return { groupId: group.id, memberIds };
  }

  it("defaults simplify to the group's own setting", async () => {
    const { groupId, memberIds } = await seedGroup(3);
    await createExpense(groupId, memberIds[0]!, {
      title: "Dinner",
      date: "2026-08-24",
      amount: "9000",
      currency: "COP",
      split: { strategy: "equal" },
    });
    await updateGroup(groupId, memberIds[0]!, { simplifyDebts: true });

    const view = await getBalancesView(groupId, memberIds[0]!, {});
    expect(view.byCurrency[0]!.simplified).toBe(true);
  });

  it("the ?simplify override changes the response but never persists", async () => {
    const { groupId, memberIds } = await seedGroup(2);
    await createExpense(groupId, memberIds[0]!, {
      title: "Dinner",
      date: "2026-08-24",
      amount: "1000",
      currency: "COP",
      split: { strategy: "equal" },
    });

    const overridden = await getBalancesView(groupId, memberIds[0]!, { simplify: true });
    expect(overridden.byCurrency[0]!.simplified).toBe(true);

    // Not persisted: the very next call with no override falls back to the
    // group's real (untouched, default-false) setting.
    const after = await getBalancesView(groupId, memberIds[0]!, {});
    expect(after.byCurrency[0]!.simplified).toBe(false);
  });

  it("a mixed-currency group returns one independent entry per currency, never a combined total", async () => {
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

    const view = await getBalancesView(groupId, memberIds[0]!, {});
    expect(view.byCurrency.map((c) => c.currency).sort()).toEqual(["COP", "USD"]);
    for (const entry of view.byCurrency) {
      const netSum = entry.members.reduce((sum, m) => sum + BigInt(m.net), 0n);
      expect(netSum).toBe(0n);
    }
  });

  it("the raw (unsimplified) plan carries no explains key on any edge", async () => {
    const { groupId, memberIds } = await seedGroup(3);
    await createExpense(groupId, memberIds[0]!, {
      title: "Dinner",
      date: "2026-08-24",
      amount: "9000",
      currency: "COP",
      split: { strategy: "equal" },
    });

    const view = await getBalancesView(groupId, memberIds[0]!, { simplify: false });
    expect(view.byCurrency[0]!.plan.length).toBeGreaterThan(0);
    for (const edge of view.byCurrency[0]!.plan) expect(edge.explains).toBeUndefined();
  });

  it("a simplified plan edge carries explains, and a settlement clears it to an empty plan", async () => {
    const { groupId, memberIds } = await seedGroup(2);
    const [ana, beto] = memberIds as [string, string];
    await createExpense(groupId, ana, {
      title: "Dinner",
      date: "2026-08-24",
      amount: "10000",
      currency: "COP",
      split: { strategy: "equal" },
    });

    const beforeSettle = await getBalancesView(groupId, ana, { simplify: true });
    expect(beforeSettle.byCurrency[0]!.plan[0]!.explains).toBeDefined();

    await createSettlement(groupId, beto, {
      toUserId: ana,
      amount: "5000",
      currency: "COP",
      settledOn: "2026-08-24",
    });
    const afterSettle = await getBalancesView(groupId, ana, { simplify: true });
    expect(afterSettle.byCurrency[0]!.plan).toEqual([]);
  });

  it("404s a non-member", async () => {
    const { groupId } = await seedGroup(1);
    await expect(getBalancesView(groupId, crypto.randomUUID(), {})).rejects.toThrow(NotAMemberError);
  });
});
