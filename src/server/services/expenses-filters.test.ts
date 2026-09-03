import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { getTestDb, hasTestDatabase, setupTestDb } from "../../test/db";
import { groupMembers, groups, users } from "../db/schema";

const DATABASE_URL_TEST = process.env.DATABASE_URL_TEST;

/**
 * T115 — search and filter over `listExpenses`. Every case here asserts
 * against the database rather than an in-memory array on purpose: the whole
 * point of the task is that filtering happens in SQL *before* the cursor,
 * so a match on page four is still a match.
 */
describe.skipIf(!hasTestDatabase)("listExpenses filters", () => {
  setupTestDb();

  let createExpense: typeof import("./expenses").createExpense;
  let deleteExpense: typeof import("./expenses").deleteExpense;
  let listExpenses: typeof import("./expenses").listExpenses;

  beforeAll(async () => {
    vi.stubEnv("APP_URL", "http://localhost:3000");
    vi.stubEnv("DATABASE_URL", DATABASE_URL_TEST ?? "");
    vi.stubEnv("AUTH_SECRET", "a".repeat(48));
    vi.stubEnv("SUPPORTED_CURRENCIES", "COP,USD,EUR");
    vi.stubEnv("DEFAULT_CURRENCY", "COP");
    vi.stubEnv("FX_PROVIDER", "open-er-api");
    vi.stubEnv("FX_BASE_CURRENCY", "USD");
    vi.stubEnv("FX_TRM_CROSSCHECK", "true");

    ({ createExpense, deleteExpense, listExpenses } = await import("./expenses"));
  });

  afterAll(() => vi.unstubAllEnvs());

  let groupId: string;
  let ana: string;
  let beto: string;
  let caro: string;

  async function seedGroup() {
    const db = getTestDb();
    const ids: string[] = [];
    for (const displayName of ["Ana", "Beto", "Caro"]) {
      const [user] = await db
        .insert(users)
        .values({
          email: `${crypto.randomUUID()}@example.com`,
          displayName,
          passwordHash: "x",
        })
        .returning();
      ids.push(user!.id);
    }
    const [group] = await db
      .insert(groups)
      .values({ title: "Cartagena", defaultCurrency: "COP", createdBy: ids[0] })
      .returning();
    for (const userId of ids) {
      await db.insert(groupMembers).values({
        groupId: group!.id,
        userId,
        role: userId === ids[0] ? "owner" : "member",
      });
    }
    [ana, beto, caro] = ids as [string, string, string];
    groupId = group!.id;
  }

  interface SeedExpense {
    title: string;
    date: string;
    currency?: string;
    category?: "comida" | "alojamiento" | "transporte" | null;
    payer?: string;
    members?: string[];
  }

  function seedExpense({ title, date, currency = "COP", category, payer, members }: SeedExpense) {
    const actor = payer ?? ana;
    return createExpense(groupId, actor, {
      title,
      date,
      amount: "3000",
      currency,
      paidBy: [{ userId: actor, amount: "3000" }],
      split: members
        ? { strategy: "equal_subset", members }
        : { strategy: "equal" },
      category: category ?? null,
    });
  }

  const titles = async (options: Parameters<typeof listExpenses>[2]) =>
    (await listExpenses(groupId, ana, options)).items.map((item) => item.title);

  beforeEach(async () => {
    await seedGroup();
    await seedExpense({ title: "Hotel Caribe", date: "2026-08-01", category: "alojamiento" });
    await seedExpense({
      title: "Cena 50% descuento",
      date: "2026-08-10",
      category: "comida",
      payer: beto,
      members: [beto, caro],
    });
    // Caro paid, only Ana owes a split — the one fixture that separates
    // "paid for it" from "owes a split of it".
    await seedExpense({
      title: "Taxi_aeropuerto",
      date: "2026-08-20",
      currency: "USD",
      category: "transporte",
      payer: caro,
      members: [ana],
    });
    // No category — the "uncategorised" bucket T090 made possible.
    await seedExpense({ title: "Mercado", date: "2026-08-31", members: [ana] });
  });

  it("returns everything when no filter is applied", async () => {
    expect(await titles({})).toHaveLength(4);
  });

  describe("q", () => {
    it("matches a case-insensitive substring of the title", async () => {
      expect(await titles({ q: "hotel" })).toEqual(["Hotel Caribe"]);
      expect(await titles({ q: "CARIBE" })).toEqual(["Hotel Caribe"]);
      expect(await titles({ q: "e" })).toHaveLength(4);
    });

    it("searches for a literal % rather than matching everything", async () => {
      expect(await titles({ q: "50%" })).toEqual(["Cena 50% descuento"]);
      expect(await titles({ q: "%" })).toEqual(["Cena 50% descuento"]);
    });

    it("searches for a literal _ rather than any single character", async () => {
      expect(await titles({ q: "Taxi_" })).toEqual(["Taxi_aeropuerto"]);
      expect(await titles({ q: "_" })).toEqual(["Taxi_aeropuerto"]);
    });

    it("treats a lone backslash as a character, not an escape", async () => {
      await seedExpense({ title: "Ida\\vuelta", date: "2026-08-05" });
      expect(await titles({ q: "\\" })).toEqual(["Ida\\vuelta"]);
    });

    it("returns nothing rather than everything when there is no match", async () => {
      expect(await titles({ q: "no existe" })).toEqual([]);
    });
  });

  describe("category", () => {
    it("matches one of the fixed keys", async () => {
      expect(await titles({ category: "alojamiento" })).toEqual(["Hotel Caribe"]);
    });

    it("matches rows with no category under the uncategorised sentinel", async () => {
      expect(await titles({ category: "uncategorised" })).toEqual(["Mercado"]);
    });
  });

  it("filters by currency", async () => {
    expect(await titles({ currency: "USD" })).toEqual(["Taxi_aeropuerto"]);
    expect(await titles({ currency: "EUR" })).toEqual([]);
  });

  describe("member", () => {
    it("matches an expense the member paid for but owes no split of", async () => {
      expect(await titles({ member: caro, currency: "USD" })).toEqual(["Taxi_aeropuerto"]);
    });

    it("matches an expense the member only owes a split of", async () => {
      expect(await titles({ member: ana, currency: "USD" })).toEqual(["Taxi_aeropuerto"]);
    });

    it("returns an expense once when the member is on both sides", async () => {
      // Ana paid Mercado and is its only split row — a join would return it
      // twice; the two EXISTS subqueries return it once.
      expect(await titles({ member: ana, q: "Mercado" })).toEqual(["Mercado"]);
    });

    it("matches every expense the member takes part in, on either side", async () => {
      const forAna = await titles({ member: ana });
      expect(forAna).toEqual(["Mercado", "Taxi_aeropuerto", "Hotel Caribe"]);
      expect(new Set(forAna).size).toBe(forAna.length);
      // Beto is in the cena and the hotel, and nothing else.
      expect(await titles({ member: beto })).toEqual(["Cena 50% descuento", "Hotel Caribe"]);
    });

    it("keeps a removed participant's history discoverable", async () => {
      await getTestDb()
        .update(groupMembers)
        .set({ removedAt: new Date() })
        .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, beto)));

      expect(await titles({ member: beto })).toEqual(["Cena 50% descuento", "Hotel Caribe"]);
    });

    it("returns nothing for someone who never participated", async () => {
      expect(await titles({ member: crypto.randomUUID() })).toEqual([]);
    });
  });

  describe("dates", () => {
    it("includes both bounds", async () => {
      expect(await titles({ from: "2026-08-01", to: "2026-08-01" })).toEqual(["Hotel Caribe"]);
      expect(await titles({ from: "2026-08-31", to: "2026-08-31" })).toEqual(["Mercado"]);
    });

    it("applies an open-ended bound on either side", async () => {
      expect(await titles({ from: "2026-08-20" })).toEqual(["Mercado", "Taxi_aeropuerto"]);
      expect(await titles({ to: "2026-08-10" })).toEqual(["Cena 50% descuento", "Hotel Caribe"]);
    });
  });

  it("combines filters with AND", async () => {
    expect(
      await titles({ q: "a", currency: "COP", member: caro, from: "2026-08-05" }),
    ).toEqual(["Cena 50% descuento"]);
    // Same filters, one currency away: an AND that matched nothing.
    expect(await titles({ currency: "USD", member: beto })).toEqual([]);
  });

  it("never returns a soft-deleted expense, filtered or not", async () => {
    const extra = await seedExpense({ title: "Hotel duplicado", date: "2026-08-02" });
    await deleteExpense(extra.id, ana);

    expect(await titles({ q: "hotel" })).toEqual(["Hotel Caribe"]);
    expect(await titles({})).toHaveLength(4);
  });

  describe("filtered pagination", () => {
    it("applies filters before the cursor, so page two is still filtered", async () => {
      for (const n of [1, 2, 3]) {
        await seedExpense({ title: `Peaje ${n}`, date: "2026-07-0" + n, currency: "USD" });
      }

      const first = await listExpenses(groupId, ana, { currency: "USD", limit: 2 });
      expect(first.items.map((i) => i.title)).toEqual(["Taxi_aeropuerto", "Peaje 3"]);
      expect(first.nextCursor).not.toBeNull();

      const second = await listExpenses(groupId, ana, {
        currency: "USD",
        limit: 2,
        cursor: first.nextCursor!,
      });
      expect(second.items.map((i) => i.title)).toEqual(["Peaje 2", "Peaje 1"]);
      expect(second.nextCursor).toBeNull();
    });

    it("neither duplicates nor skips rows sharing one date", async () => {
      for (const n of [1, 2, 3, 4]) {
        await seedExpense({ title: `Ronda ${n}`, date: "2026-09-09", currency: "EUR" });
      }

      const seen: string[] = [];
      let cursor: string | null = null;
      do {
        const page: Awaited<ReturnType<typeof listExpenses>> = await listExpenses(groupId, ana, {
          currency: "EUR",
          limit: 2,
          cursor: cursor ?? undefined,
        });
        seen.push(...page.items.map((item) => item.id));
        cursor = page.nextCursor;
      } while (cursor);

      expect(seen).toHaveLength(4);
      expect(new Set(seen).size).toBe(4);
    });
  });
});
