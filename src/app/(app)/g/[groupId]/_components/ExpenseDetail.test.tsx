import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ExpenseDetail } from "./ExpenseDetail";
import type { ExpenseSummary } from "./types";

/** Intl's `es-CO` currency literal uses a non-breaking space (U+00A0). */
const NBSP = " ";

const expense: ExpenseSummary = {
  id: "e1",
  title: "Cena",
  date: "2026-08-24",
  total: { amount: "30000000", currency: "COP" },
  payers: [{ userId: "ana", amount: "30000000", displayName: "Ana" }],
  splits: [
    { userId: "ana", amount: "15000000", displayName: "Ana" },
    { userId: "beto", amount: "15000000", displayName: "Beto" },
  ],
  strategy: "equal",
  converted: null,
  editedAt: null,
  editedBy: null,
};

describe("ExpenseDetail", () => {
  it("states how the expense was divided, in words, from the strategy", () => {
    render(<ExpenseDetail expense={expense} />);
    // strategy "equal", 2 splits.
    expect(screen.getByText("En partes iguales entre 2 personas")).toBeInTheDocument();
  });

  it("names the beneficiary for a loan", () => {
    render(
      <ExpenseDetail
        expense={{
          ...expense,
          strategy: "loan",
          splits: [{ userId: "beto", amount: "30000000", displayName: "Beto" }],
        }}
      />,
    );
    expect(screen.getByText("Préstamo a Beto")).toBeInTheDocument();
  });

  it("renders a phrase for every one of the six strategies", () => {
    const phrases: Record<string, RegExp> = {
      equal: /En partes iguales/,
      equal_subset: /En partes iguales/,
      shares: /Por participaciones/,
      percentage: /Por porcentaje/,
      exact: /Montos exactos/,
      loan: /Préstamo a/,
    };
    for (const [strategy, re] of Object.entries(phrases)) {
      const { unmount } = render(<ExpenseDetail expense={{ ...expense, strategy }} />);
      expect(screen.getByText(re)).toBeInTheDocument();
      unmount();
    }
  });

  it("renders the full payer and split breakdown", () => {
    render(<ExpenseDetail expense={expense} />);

    // The total and Ana's payer line both read $300.000, since she paid
    // the whole thing — asserting the count keeps this honest either way.
    expect(screen.getAllByText(`$${NBSP}300.000`)).toHaveLength(2);
    expect(screen.getAllByText(`$${NBSP}150.000`)).toHaveLength(2); // Ana's and Beto's splits
    expect(screen.getAllByText("Ana")).toHaveLength(2); // payer row and split row
    expect(screen.getByText("Beto")).toBeInTheDocument();
  });

  it("marks a converted total with the original amount reachable", () => {
    render(
      <ExpenseDetail
        expense={{
          ...expense,
          converted: {
            total: { amount: "7500", currency: "USD" },
            payers: [{ userId: "ana", amount: "7500", displayName: "Ana" }],
            splits: [
              { userId: "ana", amount: "3750", displayName: "Ana" },
              { userId: "beto", amount: "3750", displayName: "Beto" },
            ],
          },
        }}
      />,
    );

    // Ana both paid and is the only one whose payer line is shown, so the
    // converted US$ 75,00 appears twice: once as the total, once as her
    // payer row — the point being that the *breakdown* is converted too,
    // not just the headline figure.
    expect(screen.getAllByText(`US$${NBSP}75,00`)).toHaveLength(2);
    expect(screen.getAllByText(`US$${NBSP}37,50`)).toHaveLength(2); // Ana's and Beto's converted splits
    expect(screen.getByRole("button", { name: "Monto convertido" })).toBeInTheDocument();
  });
});
