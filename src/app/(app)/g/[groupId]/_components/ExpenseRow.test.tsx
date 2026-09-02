import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ExpenseRow } from "./ExpenseRow";
import type { ExpenseSummary } from "./types";

/** Intl's `es-CO` currency literal uses a non-breaking space (U+00A0). */
const NBSP = " ";

function expense(overrides: Partial<ExpenseSummary> = {}): ExpenseSummary {
  return {
    id: "e1",
    title: "Cena en Cartagena",
    date: "2026-08-24",
    total: { amount: "30000000", currency: "COP" },
    payers: [{ userId: "ana", amount: "30000000", displayName: "Ana" }],
    splits: [
      { userId: "ana", amount: "15000000", displayName: "Ana" },
      { userId: "beto", amount: "15000000", displayName: "Beto" },
    ],
    strategy: "equal",
    category: null,
    converted: null,
    editedAt: null,
    editedBy: null,
    ...overrides,
  };
}

describe("ExpenseRow", () => {
  it("shows the total and 'pagado por ti' for the current user's own payment", () => {
    render(<ExpenseRow expense={expense()} myUserId="ana" />);
    expect(screen.getByText(`$${NBSP}300.000`)).toBeInTheDocument();
    expect(screen.getByText(/Pagado por ti/)).toBeInTheDocument();
  });

  it("names the other payer when someone else paid", () => {
    render(<ExpenseRow expense={expense()} myUserId="beto" />);
    expect(screen.getByText(/Pagado por Ana/)).toBeInTheDocument();
  });

  it("shows a payer count when there is more than one", () => {
    render(
      <ExpenseRow
        expense={expense({
          payers: [
            { userId: "ana", amount: "15000000", displayName: "Ana" },
            { userId: "beto", amount: "15000000", displayName: "Beto" },
          ],
        })}
        myUserId="ana"
      />,
    );
    expect(screen.getByText(/Pagado por 2 personas/)).toBeInTheDocument();
  });

  it("renders your share straight from the resolved splits, not recomputed", () => {
    render(
      <ExpenseRow
        expense={expense({
          splits: [
            { userId: "ana", amount: "10000001", displayName: "Ana" },
            { userId: "beto", amount: "19999999", displayName: "Beto" },
          ],
        })}
        myUserId="beto"
      />,
    );
    // Not an even split of 30000000 — if this were recomputed client-side
    // as total/memberCount it would read 150.000, not the server's
    // uneven remainder allocation.
    expect(screen.getByText(`$${NBSP}199.999`)).toBeInTheDocument();
  });

  it("shows no 'your share' line when the current user isn't in the split", () => {
    render(<ExpenseRow expense={expense()} myUserId="caro" />);
    expect(screen.queryByText(/Tu parte/)).not.toBeInTheDocument();
  });

  it("shows the edited marker with who and when", () => {
    render(
      <ExpenseRow
        expense={expense({
          editedAt: "2026-08-25T10:00:00.000Z",
          editedBy: { userId: "beto", displayName: "Beto" },
        })}
        myUserId="ana"
      />,
    );
    expect(screen.getByText(/Editado por Beto el/)).toBeInTheDocument();
  });

  it("shows an edited marker without attribution when the editor is unknown", () => {
    render(<ExpenseRow expense={expense({ editedAt: "2026-08-25T10:00:00.000Z", editedBy: null })} myUserId="ana" />);
    expect(screen.getByText(/^Editado el/)).toBeInTheDocument();
  });

  it("shows nothing edited-related for a never-edited expense", () => {
    render(<ExpenseRow expense={expense()} myUserId="ana" />);
    expect(screen.queryByText(/Editado/)).not.toBeInTheDocument();
  });
});
