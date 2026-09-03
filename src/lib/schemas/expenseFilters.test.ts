import { describe, expect, it } from "vitest";
import {
  activeExpenseFilterCount,
  expenseFiltersToQuery,
  expenseListQuerySchema,
  parseExpenseFilters,
} from "./expenseFilters";

const MEMBER = "11111111-1111-4111-8111-111111111111";

describe("expenseListQuerySchema", () => {
  it("accepts an empty query", () => {
    expect(expenseListQuerySchema.parse({})).toEqual({});
  });

  it("keeps every filter alongside pagination", () => {
    expect(
      expenseListQuerySchema.parse({
        cursor: "abc",
        limit: "10",
        q: "hotel",
        category: "alojamiento",
        currency: "COP",
        member: MEMBER,
        from: "2026-08-01",
        to: "2026-08-31",
      }),
    ).toEqual({
      cursor: "abc",
      limit: 10,
      q: "hotel",
      category: "alojamiento",
      currency: "COP",
      member: MEMBER,
      from: "2026-08-01",
      to: "2026-08-31",
    });
  });

  it("treats a blank parameter as absent rather than as a filter", () => {
    expect(expenseListQuerySchema.parse({ q: "", category: "", member: "", from: "" })).toEqual({});
  });

  it("trims the search term and caps it at 200 characters", () => {
    const parsed = expenseListQuerySchema.parse({ q: `  ${"a".repeat(250)}  ` });
    expect(parsed.q).toHaveLength(200);
    expect(expenseListQuerySchema.parse({ q: "   " }).q).toBeUndefined();
  });

  it("accepts the uncategorised sentinel but not an unknown category", () => {
    expect(expenseListQuerySchema.parse({ category: "uncategorised" }).category).toBe(
      "uncategorised",
    );
    expect(expenseListQuerySchema.safeParse({ category: "fiesta" }).success).toBe(false);
  });

  it("rejects a non-uuid member, a bad currency, and an impossible date", () => {
    expect(expenseListQuerySchema.safeParse({ member: "ana" }).success).toBe(false);
    expect(expenseListQuerySchema.safeParse({ currency: "pesos" }).success).toBe(false);
    expect(expenseListQuerySchema.safeParse({ from: "2026-02-31" }).success).toBe(false);
    expect(expenseListQuerySchema.safeParse({ from: "1999-01-01" }).success).toBe(false);
  });

  it("rejects an inverted date range", () => {
    expect(
      expenseListQuerySchema.safeParse({ from: "2026-08-31", to: "2026-08-01" }).success,
    ).toBe(false);
    expect(
      expenseListQuerySchema.safeParse({ from: "2026-08-01", to: "2026-08-01" }).success,
    ).toBe(true);
  });

  it("rejects an unknown parameter instead of ignoring it", () => {
    expect(expenseListQuerySchema.safeParse({ sort: "amount" }).success).toBe(false);
  });

  it("never rejects a malformed limit — the service clamps it", () => {
    expect(expenseListQuerySchema.parse({ limit: "0" }).limit).toBe(0);
    expect(expenseListQuerySchema.parse({ limit: "abc" }).limit).toBeUndefined();
  });
});

describe("expenseFiltersToQuery", () => {
  it("omits everything that isn't set", () => {
    expect(expenseFiltersToQuery({})).toBe("");
    expect(expenseFiltersToQuery({ q: "hotel", category: undefined })).toBe("q=hotel");
  });

  it("escapes values so a search term survives a round trip", () => {
    expect(expenseFiltersToQuery({ q: "50% & más" })).toBe("q=50%25+%26+m%C3%A1s");
  });

  it("is stable in field order so the same filters produce the same URL", () => {
    expect(expenseFiltersToQuery({ to: "2026-08-31", q: "a", from: "2026-08-01" })).toBe(
      "q=a&from=2026-08-01&to=2026-08-31",
    );
  });
});

describe("activeExpenseFilterCount", () => {
  it("counts only the filters that are set", () => {
    expect(activeExpenseFilterCount({})).toBe(0);
    expect(activeExpenseFilterCount({ q: "a", currency: "COP" })).toBe(2);
    expect(activeExpenseFilterCount({ q: "" })).toBe(0);
  });
});

describe("parseExpenseFilters", () => {
  it("reads the filters a copied URL carries", () => {
    expect(parseExpenseFilters({ q: "hotel", currency: "USD" })).toMatchObject({
      q: "hotel",
      currency: "USD",
    });
  });

  it("takes the first value when a parameter is repeated", () => {
    expect(parseExpenseFilters({ q: ["hotel", "cena"] }).q).toBe("hotel");
  });

  it("drops an invalid value instead of failing the whole page", () => {
    const filters = parseExpenseFilters({ q: "hotel", category: "fiesta", member: "ana" });
    expect(filters).toMatchObject({ q: "hotel" });
    expect(filters.category).toBeUndefined();
    expect(filters.member).toBeUndefined();
  });

  it("drops both bounds of an inverted range rather than guessing", () => {
    const filters = parseExpenseFilters({ from: "2026-08-31", to: "2026-08-01" });
    expect(filters.from).toBeUndefined();
    expect(filters.to).toBeUndefined();
  });
});
