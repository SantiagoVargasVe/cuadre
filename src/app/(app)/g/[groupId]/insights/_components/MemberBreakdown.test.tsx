import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { formatMoney } from "../../../../../../lib/money/format";
import type { MemberBreakdownView } from "../../_components/insightsTypes";
import { MemberBreakdown } from "./MemberBreakdown";

const nameOf = (id: string) => ({ ana: "Ana", beto: "Beto" })[id] ?? id;
const cop = (minor: string) => formatMoney({ amount: BigInt(minor), currency: "COP" });

const member = (over: Partial<MemberBreakdownView> & { userId: string }): MemberBreakdownView => ({
  paid: "0",
  consumed: "0",
  expenseContribution: "0",
  sent: "0",
  received: "0",
  currentNet: "0",
  ...over,
});

describe("MemberBreakdown", () => {
  it("renders nothing when there are no members", () => {
    const { container } = render(<MemberBreakdown members={[]} currency="COP" nameOf={nameOf} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("spells out the current balance with a word and the money-semantic token, never --destructive", () => {
    render(
      <MemberBreakdown
        currency="COP"
        nameOf={nameOf}
        members={[
          member({ userId: "ana", paid: "40000", consumed: "25000", expenseContribution: "15000", currentNet: "15000" }),
          member({ userId: "beto", consumed: "15000", expenseContribution: "-15000", currentNet: "-15000" }),
        ]}
      />,
    );

    const money = cop("15000");
    const chart = within(screen.getByRole("img", { name: "Pagó vs. consumió" }));
    const owed = chart.getByText((_, element) => element?.tagName === "text" && element.textContent === `Le deben ${money}`);
    const owes = chart.getByText((_, element) => element?.tagName === "text" && element.textContent === `Debe ${money}`);
    expect(owed).toHaveClass("text-credit");
    expect(owes).toHaveClass("text-debit");
    expect(owed).toHaveClass("tabular-nums");
    expect(owed).toHaveAttribute("x", "100%");
    expect(owed).toHaveAttribute("text-anchor", "end");
    expect(owed.getAttribute("class")).not.toMatch(/destructive/);
    expect(owes.getAttribute("class")).not.toMatch(/destructive/);
    expect(chart.getByText(/balance actual por persona/)).toBeInTheDocument();
    expect(screen.getByText(/incluye los pagos ya registrados/)).toBeInTheDocument();
  });

  it("keeps a zero-activity member visible as a settled row", () => {
    render(
      <MemberBreakdown
        currency="COP"
        nameOf={nameOf}
        members={[member({ userId: "ana", paid: "1000", consumed: "1000" }), member({ userId: "beto" })]}
      />,
    );
    // The sr-only table has a row header per member, including the zero one.
    const table = screen.getByRole("table", { name: "Pagó vs. consumió" });
    expect(within(table).getByRole("rowheader", { name: "Beto" })).toBeInTheDocument();
    expect(screen.getAllByText("En ceros").length).toBeGreaterThanOrEqual(1);
  });
});
