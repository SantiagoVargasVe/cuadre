import { describe, expect, it } from "vitest";
import { createExpenseSchema } from "./expenses";

const validBody = {
  title: "Cena en Cartagena",
  date: "2026-08-24",
  amount: "30000000",
  currency: "COP",
  split: { strategy: "equal" as const },
};

describe("createExpenseSchema", () => {
  it("accepts the minimal valid payload", () => {
    expect(createExpenseSchema.safeParse(validBody).success).toBe(true);
  });

  it.each([
    ["a decimal amount", { ...validBody, amount: "12.50" }],
    ["scientific notation", { ...validBody, amount: "1e9" }],
    ["a negative amount", { ...validBody, amount: "-5" }],
    ["a year before 2000", { ...validBody, date: "1999-12-31" }],
    ["a year after 2100", { ...validBody, date: "2101-01-01" }],
    ["a four-millennia typo", { ...validBody, date: "9999-01-01" }],
    ["a malformed date", { ...validBody, date: "24-08-2026" }],
    ["an unsupported-looking currency code", { ...validBody, currency: "cop" }],
    ["a blank title", { ...validBody, title: "" }],
    ["an unknown category key", { ...validBody, category: "food" }],
    ["a category in the wrong case", { ...validBody, category: "Comida" }],
  ])("rejects %s", (_label, body) => {
    expect(createExpenseSchema.safeParse(body).success).toBe(false);
  });

  it.each([
    ["a known category key", { ...validBody, category: "comida" }],
    ["an explicit null — a PATCH clearing the category", { ...validBody, category: null }],
    ["an omitted category", validBody],
  ])("accepts %s", (_label, body) => {
    expect(createExpenseSchema.safeParse(body).success).toBe(true);
  });

  it("requires equal_subset to name at least one member", () => {
    const result = createExpenseSchema.safeParse({
      ...validBody,
      split: { strategy: "equal_subset", members: [] },
    });
    expect(result.success).toBe(false);
  });

  it("requires percentage basis points to be within 1..10000", () => {
    const memberId = "11111111-1111-4111-8111-111111111111";
    const tooHigh = createExpenseSchema.safeParse({
      ...validBody,
      split: { strategy: "percentage", basisPoints: { [memberId]: 10001 } },
    });
    const zero = createExpenseSchema.safeParse({
      ...validBody,
      split: { strategy: "percentage", basisPoints: { [memberId]: 0 } },
    });
    expect(tooHigh.success).toBe(false);
    expect(zero.success).toBe(false);
  });

  it("accepts paidBy with multiple entries", () => {
    const result = createExpenseSchema.safeParse({
      ...validBody,
      paidBy: [
        { userId: "11111111-1111-4111-8111-111111111111", amount: "1000" },
        { userId: "22222222-2222-4222-8222-222222222222", amount: "2000" },
      ],
    });
    expect(result.success).toBe(true);
  });
});
