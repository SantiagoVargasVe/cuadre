import { describe, expect, it } from "vitest";
import { cn } from "./cn";

describe("cn", () => {
  it("joins static class names", () => {
    expect(cn("a", "b")).toBe("a b");
  });

  it("drops falsy values", () => {
    expect(cn("a", false && "b", undefined, null, "c")).toBe("a c");
  });

  it("resolves conflicting Tailwind utilities, keeping the last one", () => {
    expect(cn("text-sm", "text-lg")).toBe("text-lg");
    expect(cn("p-2", "p-4")).toBe("p-4");
  });

  it("merges conditional object syntax", () => {
    expect(cn("base", { "text-debit": true, "text-credit": false })).toBe("base text-debit");
  });
});
