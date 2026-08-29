import { describe, expect, it } from "vitest";
import { settlementFormSchema, toCreateInput, todayIso } from "./settlementFormSchema";

const base = { toUserId: "beto", settledOn: "2026-08-20" };

describe("settlementFormSchema", () => {
  it("accepts any positive amount, including one over what's owed", () => {
    const schema = settlementFormSchema("COP");
    expect(schema.safeParse({ ...base, amount: "50.000" }).success).toBe(true);
    expect(schema.safeParse({ ...base, amount: "999.999.999" }).success).toBe(true);
  });

  it("rejects a zero or empty amount rather than erroring on submit", () => {
    const schema = settlementFormSchema("COP");
    expect(schema.safeParse({ ...base, amount: "0" }).success).toBe(false);
    expect(schema.safeParse({ ...base, amount: "" }).success).toBe(false);
  });

  it("caps the note at 500 characters", () => {
    const schema = settlementFormSchema("COP");
    expect(schema.safeParse({ ...base, amount: "1", note: "x".repeat(501) }).success).toBe(false);
  });
});

describe("toCreateInput", () => {
  it("converts the major-unit field to a minor-unit string at the field's currency", () => {
    const values = { toUserId: "beto", amount: "50.000", settledOn: "2026-08-20", note: "  " };
    expect(toCreateInput(values, "COP")).toEqual({
      toUserId: "beto",
      amount: "5000000",
      currency: "COP",
      settledOn: "2026-08-20",
      note: undefined,
    });
  });

  it("keeps a real note, trimmed", () => {
    const values = { toUserId: "beto", amount: "1", settledOn: "2026-08-20", note: "  cash  " };
    expect(toCreateInput(values, "USD").note).toBe("cash");
  });
});

describe("todayIso", () => {
  it("is a YYYY-MM-DD string", () => {
    expect(todayIso()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
