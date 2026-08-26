import { describe, expect, it } from "vitest";
import { isUniqueViolation } from "./pg-errors";

describe("isUniqueViolation", () => {
  it("is true for a unique violation (SQLSTATE 23505)", () => {
    expect(isUniqueViolation({ code: "23505" })).toBe(true);
  });

  it("finds the code nested under .cause, drizzle's wrapping", () => {
    expect(isUniqueViolation({ cause: { code: "23505" } })).toBe(true);
  });

  it("is false for any other error, including a different SQLSTATE", () => {
    expect(isUniqueViolation({ code: "23502" })).toBe(false);
    expect(isUniqueViolation(new Error("boom"))).toBe(false);
    expect(isUniqueViolation(null)).toBe(false);
    expect(isUniqueViolation(undefined)).toBe(false);
  });
});
