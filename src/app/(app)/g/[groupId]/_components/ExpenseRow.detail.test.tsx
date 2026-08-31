import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ExpenseRow } from "./ExpenseRow";
import type { ExpenseSummary } from "./types";

/** The T102 concern: the row is a discoverable, network-free dialog trigger. */
const expense: ExpenseSummary = {
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
  converted: null,
  editedAt: null,
  editedBy: null,
};

afterEach(() => vi.unstubAllGlobals());

describe("ExpenseRow — discoverable detail (T102)", () => {
  it("announces itself as a dialog trigger whose name is the expense, not 'button'", () => {
    render(<ExpenseRow expense={expense} myUserId="ana" />);
    const trigger = screen.getByRole("button");
    expect(trigger).toHaveAttribute("aria-haspopup", "dialog");
    expect(trigger).toHaveAccessibleName(/Cena en Cartagena/);
  });

  it("opens the split breakdown with no network request", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();

    render(<ExpenseRow expense={expense} myUserId="ana" />);
    await user.click(screen.getByRole("button"));

    // payers/splits on the row are complete — a per-expense fetch would fan
    // the feed out into N+1.
    expect(await screen.findByText("Dividido entre")).toBeInTheDocument();
    expect(await screen.findByText("En partes iguales entre 2 personas")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
