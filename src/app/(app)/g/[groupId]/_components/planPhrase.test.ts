import { describe, expect, it } from "vitest";
import { planEdgePhrase } from "./planPhrase";

const names: Record<string, string> = { ana: "Ana", beto: "Beto", caro: "Caro" };
const nameOf = (id: string) => names[id] ?? "?";

describe("planEdgePhrase", () => {
  it("phrases an edge where I am the debtor as an instruction to pay", () => {
    const phrase = planEdgePhrase({ from: "ana", to: "beto", amount: "2000000" }, "COP", "ana", nameOf);
    expect(phrase).toMatch(/^Le debes a Beto \$\s20\.000$/);
  });

  it("phrases an edge where I am the creditor as being owed", () => {
    const phrase = planEdgePhrase({ from: "beto", to: "ana", amount: "2000000" }, "COP", "ana", nameOf);
    expect(phrase).toMatch(/^Beto te debe \$\s20\.000$/);
  });

  it("phrases an edge between two other members in the third person", () => {
    const phrase = planEdgePhrase({ from: "beto", to: "caro", amount: "1000000" }, "COP", "ana", nameOf);
    expect(phrase).toMatch(/^Beto le debe a Caro \$\s10\.000$/);
  });

  it("never renders a bare signed amount — always a direction sentence", () => {
    const phrase = planEdgePhrase({ from: "ana", to: "beto", amount: "500000" }, "COP", "ana", nameOf);
    expect(phrase).not.toMatch(/^[+-]/);
    expect(phrase).toContain("Beto");
  });
});
