import { desc, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { hasTestDatabase, setupTestDb, getTestDb } from "../../test/db";
import { expenseRevisions, groupMembers, groups, users } from "../db/schema";

const DATABASE_URL_TEST = process.env.DATABASE_URL_TEST;

describe.skipIf(!hasTestDatabase)("expense categories (T090)", () => {
  setupTestDb();

  let createExpense: typeof import("./expenses").createExpense;
  let updateExpense: typeof import("./expenses").updateExpense;
  let getExpense: typeof import("./expenses").getExpense;

  beforeAll(async () => {
    vi.stubEnv("APP_URL", "http://localhost:3000");
    vi.stubEnv("DATABASE_URL", DATABASE_URL_TEST ?? "");
    vi.stubEnv("AUTH_SECRET", "a".repeat(48));
    vi.stubEnv("SUPPORTED_CURRENCIES", "COP,USD,EUR");
    vi.stubEnv("DEFAULT_CURRENCY", "COP");
    vi.stubEnv("FX_PROVIDER", "open-er-api");
    vi.stubEnv("FX_BASE_CURRENCY", "USD");
    vi.stubEnv("FX_TRM_CROSSCHECK", "true");

    ({ createExpense, updateExpense, getExpense } = await import("./expenses"));
  });

  afterAll(() => vi.unstubAllEnvs());

  async function seedGroup() {
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
    return { groupId: group!.id, ownerId: owner!.id };
  }

  const base = { title: "Cena", date: "2026-08-24", amount: "1000", currency: "COP" } as const;
  const equalSplit = { split: { strategy: "equal" } } as const;

  async function latestSnapshot(expenseId: string) {
    const [revision] = await getTestDb()
      .select()
      .from(expenseRevisions)
      .where(eq(expenseRevisions.expenseId, expenseId))
      .orderBy(desc(expenseRevisions.version))
      .limit(1);
    return revision;
  }

  it("stores a category on create and echoes it on the read path and the created revision", async () => {
    const { groupId, ownerId } = await seedGroup();
    const created = await createExpense(groupId, ownerId, {
      ...base,
      ...equalSplit,
      category: "comida",
    });

    expect(created.category).toBe("comida");
    expect(await getExpense(created.id, ownerId).then((e) => e.category)).toBe("comida");
    expect(await latestSnapshot(created.id).then((r) => r?.snapshot)).toMatchObject({
      category: "comida",
    });
  });

  it("defaults to null when no category is given", async () => {
    const { groupId, ownerId } = await seedGroup();
    const created = await createExpense(groupId, ownerId, { ...base, ...equalSplit });

    expect(created.category).toBeNull();
    expect(await getExpense(created.id, ownerId).then((e) => e.category)).toBeNull();
  });

  it("PATCH replaces the category and records the change in the revision snapshot", async () => {
    const { groupId, ownerId } = await seedGroup();
    const created = await createExpense(groupId, ownerId, {
      ...base,
      ...equalSplit,
      category: "comida",
    });

    const updated = await updateExpense(created.id, ownerId, {
      ...base,
      ...equalSplit,
      category: "transporte",
    });

    expect(updated.category).toBe("transporte");
    expect(await latestSnapshot(created.id).then((r) => r?.snapshot)).toMatchObject({
      category: "transporte",
    });
  });

  it("PATCH with no category clears one that was set", async () => {
    const { groupId, ownerId } = await seedGroup();
    const created = await createExpense(groupId, ownerId, {
      ...base,
      ...equalSplit,
      category: "alojamiento",
    });

    const cleared = await updateExpense(created.id, ownerId, { ...base, ...equalSplit });

    expect(cleared.category).toBeNull();
    expect(await getExpense(created.id, ownerId).then((e) => e.category)).toBeNull();
    expect(await latestSnapshot(created.id).then((r) => r?.snapshot)).toMatchObject({
      category: null,
    });
  });

  it("still rejects an unknown key at the database if one slips past Zod", async () => {
    const { groupId, ownerId } = await seedGroup();
    await expect(
      // @ts-expect-error the service type only allows known keys — this proves the FK is a real backstop
      createExpense(groupId, ownerId, { ...base, ...equalSplit, category: "food" }),
    ).rejects.toThrow();
  });
});
