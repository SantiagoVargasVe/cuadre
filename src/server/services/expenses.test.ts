import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { hasTestDatabase, setupTestDb, getTestDb } from "../../test/db";
import { expenseRevisions, groupMembers, groups, users } from "../db/schema";

const DATABASE_URL_TEST = process.env.DATABASE_URL_TEST;

describe.skipIf(!hasTestDatabase)("createExpense", () => {
  setupTestDb();

  let createExpense: typeof import("./expenses").createExpense;
  let getExpense: typeof import("./expenses").getExpense;
  let PayersDoNotBalanceError: typeof import("./expenses").PayersDoNotBalanceError;
  let SplitsDoNotBalanceError: typeof import("./expenses").SplitsDoNotBalanceError;
  let PercentagesDoNotSumTo10000Error: typeof import("./expenses").PercentagesDoNotSumTo10000Error;
  let NotAGroupMemberOnExpenseError: typeof import("./expenses").NotAGroupMemberOnExpenseError;
  let UnsupportedCurrencyError: typeof import("./currencies").UnsupportedCurrencyError;
  let NotAMemberError: typeof import("../auth/membership").NotAMemberError;
  let GroupArchivedError: typeof import("../auth/membership").GroupArchivedError;
  let ValidationError: typeof import("../errors").ValidationError;

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
      createExpense,
      getExpense,
      PayersDoNotBalanceError,
      SplitsDoNotBalanceError,
      PercentagesDoNotSumTo10000Error,
      NotAGroupMemberOnExpenseError,
    } = await import("./expenses"));
    ({ UnsupportedCurrencyError } = await import("./currencies"));
    ({ ValidationError } = await import("../errors"));
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

  it("defaults paidBy to the actor and split to every current member", async () => {
    const { groupId, memberIds } = await seedGroup(3);
    const [ana] = memberIds;

    const result = await createExpense(groupId, ana!, {
      title: "Dinner",
      date: "2026-08-24",
      amount: "9000",
      currency: "COP",
      split: { strategy: "equal" },
    });

    expect(result.payers).toEqual([{ userId: ana, amount: "9000" }]);
    expect(result.splits).toHaveLength(3);
    expect(
      result.splits.reduce((sum, s) => sum + BigInt(s.amount), 0n),
    ).toBe(9000n);
    expect(result.strategy).toBe("equal");
    expect(result.version).toBe(1);
    expect(result.editedAt).toBeNull();
  });

  it("splits the splitting.md worked example exactly: 10,000,000 COP three ways", async () => {
    const { groupId, memberIds } = await seedGroup(3);

    const result = await createExpense(groupId, memberIds[0]!, {
      title: "Dinner",
      date: "2026-08-24",
      amount: "10000000",
      currency: "COP",
      split: { strategy: "equal" },
    });

    const amounts = result.splits.map((s) => BigInt(s.amount)).sort((a, b) => (a < b ? -1 : 1));
    expect(amounts).toEqual([3333333n, 3333333n, 3333334n]);
    expect(amounts.reduce((a, b) => a + b, 0n)).toBe(10000000n);
  });

  it("resolves equal_subset over the given members only", async () => {
    const { groupId, memberIds } = await seedGroup(3);
    const result = await createExpense(groupId, memberIds[0]!, {
      title: "Just us two",
      date: "2026-08-24",
      amount: "100",
      currency: "COP",
      split: { strategy: "equal_subset", members: [memberIds[0]!, memberIds[1]!] },
    });
    expect(result.splits.map((s) => s.userId).sort()).toEqual([memberIds[0], memberIds[1]].sort());
  });

  it("resolves shares — the couple counts as two", async () => {
    const { groupId, memberIds } = await seedGroup(2);
    const result = await createExpense(groupId, memberIds[0]!, {
      title: "Hotel",
      date: "2026-08-24",
      amount: "300",
      currency: "COP",
      split: { strategy: "shares", weights: { [memberIds[0]!]: 2, [memberIds[1]!]: 1 } },
    });
    const byId = new Map(result.splits.map((s) => [s.userId, s.amount]));
    expect(byId.get(memberIds[0]!)).toBe("200");
    expect(byId.get(memberIds[1]!)).toBe("100");
  });

  it("resolves percentage — 60/40 with no remainder", async () => {
    const { groupId, memberIds } = await seedGroup(2);
    const result = await createExpense(groupId, memberIds[0]!, {
      title: "Taxi",
      date: "2026-08-24",
      amount: "10000",
      currency: "USD",
      split: {
        strategy: "percentage",
        basisPoints: { [memberIds[0]!]: 6000, [memberIds[1]!]: 4000 },
      },
    });
    const byId = new Map(result.splits.map((s) => [s.userId, s.amount]));
    expect(byId.get(memberIds[0]!)).toBe("6000");
    expect(byId.get(memberIds[1]!)).toBe("4000");
  });

  it("rejects percentages that don't sum to 10000, naming the actual sum", async () => {
    const { groupId, memberIds } = await seedGroup(2);
    const attempt = createExpense(groupId, memberIds[0]!, {
      title: "Bad",
      date: "2026-08-24",
      amount: "10000",
      currency: "USD",
      split: {
        strategy: "percentage",
        basisPoints: { [memberIds[0]!]: 5000, [memberIds[1]!]: 4000 },
      },
    });
    await expect(attempt).rejects.toThrow(PercentagesDoNotSumTo10000Error);
  });

  it("resolves exact — caller-supplied amounts pass through unchanged", async () => {
    const { groupId, memberIds } = await seedGroup(2);
    const result = await createExpense(groupId, memberIds[0]!, {
      title: "Exact",
      date: "2026-08-24",
      amount: "10000",
      currency: "COP",
      split: {
        strategy: "exact",
        amounts: { [memberIds[0]!]: "4200", [memberIds[1]!]: "5800" },
      },
    });
    const byId = new Map(result.splits.map((s) => [s.userId, s.amount]));
    expect(byId.get(memberIds[0]!)).toBe("4200");
    expect(byId.get(memberIds[1]!)).toBe("5800");
  });

  it("rejects exact amounts that don't sum to the total, with expected/actual/difference", async () => {
    const { groupId, memberIds } = await seedGroup(2);
    const attempt = createExpense(groupId, memberIds[0]!, {
      title: "Bad exact",
      date: "2026-08-24",
      amount: "10000",
      currency: "COP",
      split: {
        strategy: "exact",
        amounts: { [memberIds[0]!]: "4000", [memberIds[1]!]: "5800" },
      },
    });
    const error = await attempt.catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(SplitsDoNotBalanceError);
    expect((error as InstanceType<typeof SplitsDoNotBalanceError>).details).toEqual({
      expected: "10000",
      actual: "9800",
      difference: "200",
    });
  });

  it("resolves loan — one beneficiary at 100%", async () => {
    const { groupId, memberIds } = await seedGroup(2);
    const result = await createExpense(groupId, memberIds[0]!, {
      title: "Loan",
      date: "2026-08-24",
      amount: "5000",
      currency: "COP",
      split: { strategy: "loan", to: memberIds[1]! },
    });
    expect(result.splits).toEqual([{ userId: memberIds[1], amount: "5000" }]);
  });

  it("reconstructs every stored split strategy for the detail editor", async () => {
    const { groupId, memberIds } = await seedGroup(2);
    const [ana, beto] = memberIds as [string, string];
    const create = (title: string, amount: string, split: Parameters<typeof createExpense>[2]["split"]) =>
      createExpense(groupId, ana, { title, date: "2026-08-24", amount, currency: "COP", split });

    const equal = await create("Equal", "100", { strategy: "equal" });
    expect((await getExpense(equal.id, ana)).split).toEqual({ strategy: "equal", members: [ana, beto].sort() });
    const subset = await create("Subset", "100", { strategy: "equal_subset", members: [beto] });
    expect((await getExpense(subset.id, ana)).split).toEqual({ strategy: "equal_subset", members: [beto] });
    const shares = await create("Shares", "300", { strategy: "shares", weights: { [ana]: 2, [beto]: 1 } });
    expect((await getExpense(shares.id, ana)).split).toEqual({ strategy: "shares", weights: { [ana]: 2, [beto]: 1 } });
    const percentage = await create("Percentage", "10000", {
      strategy: "percentage", basisPoints: { [ana]: 6000, [beto]: 4000 },
    });
    expect((await getExpense(percentage.id, ana)).split).toEqual({
      strategy: "percentage", basisPoints: { [ana]: 6000, [beto]: 4000 },
    });
    const exact = await create("Exact", "100", { strategy: "exact", amounts: { [ana]: "40", [beto]: "60" } });
    expect((await getExpense(exact.id, ana)).split).toEqual({
      strategy: "exact", amounts: { [ana]: "40", [beto]: "60" },
    });
    const loan = await create("Loan", "100", { strategy: "loan", to: beto });
    expect((await getExpense(loan.id, ana)).split).toEqual({ strategy: "loan", to: beto });
  });

  it("wraps any other money-module error (e.g. no shares members at all) as a generic 422", async () => {
    const { groupId, memberIds } = await seedGroup(1);
    const attempt = createExpense(groupId, memberIds[0]!, {
      title: "Empty shares",
      date: "2026-08-24",
      amount: "100",
      currency: "COP",
      split: { strategy: "shares", weights: {} },
    });
    const error = await attempt.catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(ValidationError);
    expect((error as InstanceType<typeof ValidationError>).code).toBe("INVALID_SPLIT");
  });

  it("accepts multiple explicit payers that sum to the total", async () => {
    const { groupId, memberIds } = await seedGroup(2);
    const result = await createExpense(groupId, memberIds[0]!, {
      title: "Split payment",
      date: "2026-08-24",
      amount: "300",
      currency: "COP",
      paidBy: [
        { userId: memberIds[0]!, amount: "200" },
        { userId: memberIds[1]!, amount: "100" },
      ],
      split: { strategy: "equal" },
    });
    expect(result.payers.sort((a, b) => a.amount.localeCompare(b.amount))).toEqual(
      [
        { userId: memberIds[1], amount: "100" },
        { userId: memberIds[0], amount: "200" },
      ].sort((a, b) => a.amount.localeCompare(b.amount)),
    );
  });

  it("rejects payers that don't sum to the total", async () => {
    const { groupId, memberIds } = await seedGroup(2);
    const attempt = createExpense(groupId, memberIds[0]!, {
      title: "Bad payers",
      date: "2026-08-24",
      amount: "300",
      currency: "COP",
      paidBy: [{ userId: memberIds[0]!, amount: "100" }],
      split: { strategy: "equal" },
    });
    await expect(attempt).rejects.toThrow(PayersDoNotBalanceError);
  });

  it("rejects a non-member payer, naming them in details.userIds", async () => {
    const { groupId, memberIds } = await seedGroup(1);
    const outsiderId = crypto.randomUUID();
    const attempt = createExpense(groupId, memberIds[0]!, {
      title: "Outsider payer",
      date: "2026-08-24",
      amount: "100",
      currency: "COP",
      paidBy: [{ userId: outsiderId, amount: "100" }],
      split: { strategy: "equal" },
    });
    const error = await attempt.catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(NotAGroupMemberOnExpenseError);
    expect((error as InstanceType<typeof NotAGroupMemberOnExpenseError>).details).toEqual({
      userIds: [outsiderId],
    });
  });

  it("rejects a non-member split target the same way", async () => {
    const { groupId, memberIds } = await seedGroup(1);
    const outsiderId = crypto.randomUUID();
    const attempt = createExpense(groupId, memberIds[0]!, {
      title: "Outsider split",
      date: "2026-08-24",
      amount: "100",
      currency: "COP",
      split: { strategy: "loan", to: outsiderId },
    });
    await expect(attempt).rejects.toThrow(NotAGroupMemberOnExpenseError);
  });

  it("leaves no expense row behind when the write is rejected", async () => {
    const { groupId, memberIds } = await seedGroup(1);
    await createExpense(groupId, memberIds[0]!, {
      title: "Outsider split",
      date: "2026-08-24",
      amount: "100",
      currency: "COP",
      split: { strategy: "loan", to: crypto.randomUUID() },
    }).catch(() => undefined);

    const revisions = await getTestDb().select().from(expenseRevisions);
    expect(revisions).toHaveLength(0);
  });

  it("throws NotAMemberError (404) for a non-member of the group", async () => {
    const { groupId } = await seedGroup(1);
    const outsiderId = crypto.randomUUID();
    const attempt = createExpense(groupId, outsiderId, {
      title: "Nope",
      date: "2026-08-24",
      amount: "100",
      currency: "COP",
      split: { strategy: "equal" },
    });
    await expect(attempt).rejects.toThrow(NotAMemberError);
  });

  it("rejects an unsupported currency", async () => {
    const { groupId, memberIds } = await seedGroup(1);
    const attempt = createExpense(groupId, memberIds[0]!, {
      title: "Yen",
      date: "2026-08-24",
      amount: "100",
      currency: "JPY",
      split: { strategy: "equal" },
    });
    await expect(attempt).rejects.toThrow(UnsupportedCurrencyError);
  });

  it("rejects a write against an archived group", async () => {
    const { groupId, memberIds } = await seedGroup(1);
    await getTestDb().update(groups).set({ archivedAt: new Date() }).where(eq(groups.id, groupId));

    const attempt = createExpense(groupId, memberIds[0]!, {
      title: "Too late",
      date: "2026-08-24",
      amount: "100",
      currency: "COP",
      split: { strategy: "equal" },
    });
    await expect(attempt).rejects.toThrow(GroupArchivedError);
  });

  it("writes a version-1 'created' revision with a snapshot", async () => {
    const { groupId, memberIds } = await seedGroup(1);
    const result = await createExpense(groupId, memberIds[0]!, {
      title: "Solo",
      date: "2026-08-24",
      amount: "100",
      currency: "COP",
      split: { strategy: "equal" },
    });

    const [revision] = await getTestDb()
      .select()
      .from(expenseRevisions)
      .where(eq(expenseRevisions.expenseId, result.id));
    expect(revision?.version).toBe(1);
    expect(revision?.action).toBe("created");
    expect(revision?.snapshot).toMatchObject({ totalAmount: "100", currency: "COP" });
  });
});
