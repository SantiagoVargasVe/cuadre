import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { formatMoney } from "../../../../../../lib/money/format";
import type { SummaryView } from "../../_components/insightsTypes";
import { SummaryCard } from "./SummaryCard";

const nameOf = (id: string) => ({ ana: "Ana", beto: "Beto" })[id] ?? id;
const cop = (minor: string) => formatMoney({ amount: BigInt(minor), currency: "COP" });
/** Money renders inside a <Money> span whose NBSP defeats getByText's normalizer; match the leaf directly. */
const money = (rendered: string) => (_: string, el: Element | null) =>
  !!el && el.children.length === 0 && el.textContent === rendered;

const base: SummaryView = {
  totalSpent: "120000",
  expenseCount: 3,
  firstExpenseDate: "2026-08-20",
  lastExpenseDate: "2026-09-01",
  averagePerExpense: "40000",
  largestExpense: { title: "Hotel", amount: "80000", currency: "COP", payers: ["Ana", "Beto"] },
  carrying: { userId: "ana", amount: "34000" },
};

describe("SummaryCard", () => {
  it("shows the server-provided figures and who's carrying, as a sentence", () => {
    render(<SummaryCard summary={base} currency="COP" nameOf={nameOf} />);
    expect(screen.getByText(money(cop("120000")))).toBeInTheDocument();
    expect(screen.getByText("3 gastos")).toBeInTheDocument();
    expect(screen.getByText(money(cop("40000")))).toBeInTheDocument();
    expect(screen.getByText(/Hotel/)).toBeInTheDocument();
    expect(screen.getByText(money(cop("80000")))).toBeInTheDocument();
    // Carrying is a sentence around a <Money>, never a bare signed number.
    expect(screen.getByText(/Ana ha puesto/)).toBeInTheDocument();
    expect(screen.getByText(/de más/)).toBeInTheDocument();
    expect(screen.getByText(money(cop("34000")))).toBeInTheDocument();
    expect(screen.queryByText(/\+/)).not.toBeInTheDocument();
  });

  it("says nobody is carrying when currentNet is all zero", () => {
    render(<SummaryCard summary={{ ...base, carrying: null }} currency="COP" nameOf={nameOf} />);
    expect(screen.getByText("Por ahora nadie está fronteando el grupo.")).toBeInTheDocument();
  });

  it("renders a calm line, not zeros, for a currency with no expenses", () => {
    const empty: SummaryView = {
      totalSpent: "0",
      expenseCount: 0,
      firstExpenseDate: null,
      lastExpenseDate: null,
      averagePerExpense: "0",
      largestExpense: null,
      carrying: null,
    };
    render(<SummaryCard summary={empty} currency="COP" nameOf={nameOf} />);
    expect(screen.getByText("Aún no hay gastos en esta moneda.")).toBeInTheDocument();
    expect(screen.queryByText("Total gastado")).not.toBeInTheDocument();
  });
});
