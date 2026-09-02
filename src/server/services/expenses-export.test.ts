import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { parseCsvRecords } from "../../lib/csvTestHelpers";
import { hasTestDatabase, getTestDb, setupTestDb } from "../../test/db";
import { groupMembers, groups, users } from "../db/schema";

const DATABASE_URL_TEST = process.env.DATABASE_URL_TEST;

describe.skipIf(!hasTestDatabase)("exportExpensesCsv", () => {
  setupTestDb();

  let exportExpensesCsv: typeof import("./expenses-export").exportExpensesCsv;
  let EXPENSE_CSV_COLUMNS: typeof import("./expenses-export").EXPENSE_CSV_COLUMNS;
  let createExpense: typeof import("./expenses").createExpense;
  let deleteExpense: typeof import("./expenses").deleteExpense;
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
    ({ exportExpensesCsv, EXPENSE_CSV_COLUMNS } = await import("./expenses-export"));
    ({ createExpense, deleteExpense } = await import("./expenses"));
    ({ NotAMemberError } = await import("../auth/membership"));
  });

  afterAll(() => vi.unstubAllEnvs());

  async function seedGroup(names: string[]) {
    const db = getTestDb();
    const memberIds: string[] = [];
    for (const displayName of names) {
      const [user] = await db.insert(users).values({
        email: `${crypto.randomUUID()}@example.com`, displayName, passwordHash: "x",
      }).returning();
      memberIds.push(user!.id);
    }
    const [group] = await db.insert(groups).values({
      title: "Cartagena 2026", defaultCurrency: "COP", createdBy: memberIds[0]!,
    }).returning();
    await db.insert(groupMembers).values(memberIds.map((userId, index) => ({
      groupId: group!.id, userId, role: index === 0 ? "owner" as const : "member" as const,
    })));
    return { groupId: group!.id, memberIds };
  }

  async function records(groupId: string, userId: string) {
    const result = await exportExpensesCsv(groupId, userId);
    return { ...result, ...parseCsvRecords(result.csv) };
  }

  it("rejects non-members and removed members rather than returning an empty file", async () => {
    const { groupId, memberIds } = await seedGroup(["Ana", "Beto"]);
    const [ana, beto] = memberIds as [string, string];
    const [outsider] = await getTestDb().insert(users).values({
      email: `${crypto.randomUUID()}@example.com`, displayName: "Nadie", passwordHash: "x",
    }).returning();

    await expect(exportExpensesCsv(groupId, outsider!.id)).rejects.toThrow(NotAMemberError);
    await getTestDb().update(groupMembers).set({ removedAt: new Date() })
      .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, beto)));
    await expect(exportExpensesCsv(groupId, beto)).rejects.toThrow(NotAMemberError);
    await expect(exportExpensesCsv(groupId, ana)).resolves.toMatchObject({ csv: expect.any(String) });
  });

  it("emits the exact header for an empty group", async () => {
    const { groupId, memberIds } = await seedGroup(["Ana"]);
    const result = await records(groupId, memberIds[0]!);
    expect(result.header).toEqual([...EXPENSE_CSV_COLUMNS]);
    expect(result.records).toEqual([]);
  });

  it("preserves multiple payers and non-equal splits as JSON minor-unit strings", async () => {
    const { groupId, memberIds } = await seedGroup(["Ana", "Beto"]);
    const [ana, beto] = memberIds as [string, string];
    await createExpense(groupId, ana, {
      title: "Hotel", date: "2026-08-24", amount: "30000000", currency: "COP",
      paidBy: [{ userId: ana, amount: "20000000" }, { userId: beto, amount: "10000000" }],
      split: { strategy: "exact", amounts: { [ana]: "10000000", [beto]: "20000000" } },
    });

    const [row] = (await records(groupId, ana)).records;
    expect(row).toMatchObject({ amount_minor: "30000000", currency: "COP", split_strategy: "exact" });
    expect(JSON.parse(row!.payers!)).toEqual(expect.arrayContaining([
      { userId: ana, displayName: "Ana", amount: "20000000" },
      { userId: beto, displayName: "Beto", amount: "10000000" },
    ]));
    expect(JSON.parse(row!.splits!)).toEqual(expect.arrayContaining([
      { userId: ana, displayName: "Ana", amount: "10000000" },
      { userId: beto, displayName: "Beto", amount: "20000000" },
    ]));
  });

  it("orders live rows by date then id and retains each entered currency", async () => {
    const { groupId, memberIds } = await seedGroup(["Ana"]);
    const userId = memberIds[0]!;
    const later = await createExpense(groupId, userId, {
      title: "USD", date: "2026-08-25", amount: "8645", currency: "USD", split: { strategy: "equal" },
    });
    const first = await createExpense(groupId, userId, {
      title: "COP", date: "2026-08-24", amount: "30000000", currency: "COP", split: { strategy: "equal" },
    });
    const deleted = await createExpense(groupId, userId, {
      title: "Deleted", date: "2026-08-23", amount: "100", currency: "EUR", split: { strategy: "equal" },
    });
    await deleteExpense(deleted.id, userId);
    await getTestDb().update(groups).set({ displayCurrency: "USD" }).where(eq(groups.id, groupId));

    const result = await records(groupId, userId);
    expect(result.records.map((row) => row.expense_id)).toEqual([first.id, later.id]);
    expect(result.records.map((row) => [row.currency, row.amount_minor])).toEqual([
      ["COP", "30000000"], ["USD", "8645"],
    ]);
    expect(result.header).not.toContain("converted_total");
  });

  it("still exports an archived group — archive is read-only, not invisible", async () => {
    const { groupId, memberIds } = await seedGroup(["Ana"]);
    const userId = memberIds[0]!;
    const expense = await createExpense(groupId, userId, {
      title: "Antes de archivar", date: "2026-08-24", amount: "1000", currency: "COP",
      split: { strategy: "equal" },
    });
    await getTestDb().update(groups).set({ archivedAt: new Date() }).where(eq(groups.id, groupId));

    const result = await records(groupId, userId);
    expect(result.records.map((row) => row.expense_id)).toEqual([expense.id]);
  });

  it("quotes RFC 4180 text, escapes formula titles, and keeps hostile names valid JSON", async () => {
    const { groupId, memberIds } = await seedGroup(["=cmd|'/c calc'!A1"]);
    await createExpense(groupId, memberIds[0]!, {
      title: '  =SUM(A1:A9), "quoted"\nnext line', date: "2026-08-24", amount: "100", currency: "COP",
      split: { strategy: "equal" },
    });

    const result = await records(groupId, memberIds[0]!);
    expect(result.records[0]!.title).toBe("'  =SUM(A1:A9), \"quoted\"\nnext line");
    expect(JSON.parse(result.records[0]!.payers!)[0]).toMatchObject({ displayName: "=cmd|'/c calc'!A1" });
    expect(result.records[0]!.payers).toMatch(/^\[/);
  });
});
