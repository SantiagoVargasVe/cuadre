import { describe, expect, it } from "vitest";
import { strategyPhrase } from "./strategyPhrase";

describe("strategyPhrase", () => {
  it("phrases each of the six stored strategies", () => {
    const ctx = { splitCount: 4, loanTo: "Ana" };
    expect(strategyPhrase("equal", ctx)).toBe("En partes iguales entre 4 personas");
    expect(strategyPhrase("equal_subset", ctx)).toBe("En partes iguales entre 4 personas");
    expect(strategyPhrase("shares", ctx)).toBe("Por participaciones");
    expect(strategyPhrase("percentage", ctx)).toBe("Por porcentaje");
    expect(strategyPhrase("exact", ctx)).toBe("Montos exactos");
    expect(strategyPhrase("loan", ctx)).toBe("Préstamo a Ana");
  });

  it("singularises the equal phrase for a one-person split", () => {
    expect(strategyPhrase("equal", { splitCount: 1, loanTo: "" })).toBe(
      "En partes iguales entre 1 persona",
    );
  });

  it("falls back rather than throwing on an unrecognised strategy", () => {
    expect(strategyPhrase("something_new", { splitCount: 2, loanTo: "" })).toBe(
      "Dividido entre los participantes",
    );
  });
});
