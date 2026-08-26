import { describe, expect, it } from "vitest";
import { createSettlementSchema } from "./settlements";

const validBody = {
  toUserId: "11111111-1111-4111-8111-111111111111",
  amount: "50000",
  currency: "COP",
  settledOn: "2026-08-24",
};

describe("createSettlementSchema", () => {
  it("accepts the minimal valid payload", () => {
    expect(createSettlementSchema.safeParse(validBody).success).toBe(true);
  });

  it("accepts an optional note up to 500 characters", () => {
    expect(createSettlementSchema.safeParse({ ...validBody, note: "a".repeat(500) }).success).toBe(
      true,
    );
  });

  it.each([
    ["a decimal amount", { ...validBody, amount: "12.50" }],
    ["scientific notation", { ...validBody, amount: "1e9" }],
    ["a negative amount", { ...validBody, amount: "-5" }],
    ["a year before 2000", { ...validBody, settledOn: "1999-12-31" }],
    ["a year after 2100", { ...validBody, settledOn: "2101-01-01" }],
    ["a malformed date", { ...validBody, settledOn: "24-08-2026" }],
    ["an unsupported-looking currency code", { ...validBody, currency: "cop" }],
    ["a non-uuid toUserId", { ...validBody, toUserId: "not-a-uuid" }],
    ["a note over 500 characters", { ...validBody, note: "a".repeat(501) }],
  ])("rejects %s", (_label, body) => {
    expect(createSettlementSchema.safeParse(body).success).toBe(false);
  });
});
