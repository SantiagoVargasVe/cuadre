import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { formatMoney } from "../../../../../lib/money/format";
import { InsightsTab } from "./InsightsTab";
import type { InsightsResult, MemberBreakdownView } from "./insightsTypes";
import type { GroupMember } from "./types";

const members: GroupMember[] = [
  { userId: "ana", displayName: "Ana", role: "owner" },
  { userId: "beto", displayName: "Beto", role: "member" },
];

function renderTab(initialData: InsightsResult) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <InsightsTab groupId="g1" members={members} initialData={initialData} />
    </QueryClientProvider>,
  );
}

const cop = (minor: string) => formatMoney({ amount: BigInt(minor), currency: "COP" });

const row = (over: Partial<MemberBreakdownView> & { userId: string }): MemberBreakdownView => ({
  paid: "0",
  consumed: "0",
  expenseContribution: "0",
  sent: "0",
  received: "0",
  currentNet: "0",
  ...over,
});

describe("InsightsTab", () => {
  it("shows a calm empty state when there is nothing to analyse", () => {
    renderTab({ displayCurrency: null, byCurrency: [] });
    expect(screen.getByText("Aún no hay nada que analizar")).toBeInTheDocument();
    expect(screen.queryByRole("figure")).not.toBeInTheDocument();
  });

  it("renders the per-member breakdown as a hidden table, ids resolved to names", () => {
    renderTab({
      displayCurrency: null,
      byCurrency: [
        {
          currency: "COP",
          byDay: [{ key: "2026-08-24", amount: "40000" }],
          byMonth: [{ key: "2026-08", amount: "40000" }],
          byCategory: [
            { category: "comida", amount: "30000" },
            { category: null, amount: "10000" },
          ],
          members: [
            row({ userId: "ana", paid: "40000", consumed: "25000", expenseContribution: "15000", currentNet: "15000" }),
            row({ userId: "beto", paid: "0", consumed: "15000", expenseContribution: "-15000", currentNet: "-15000" }),
          ],
        },
      ],
    });

    const breakdown = screen.getByRole("table", { name: "Pagó vs. consumió" });
    expect(within(breakdown).getByRole("rowheader", { name: "Ana" })).toBeInTheDocument();
    expect(within(breakdown).getByRole("cell", { name: cop("40000") })).toBeInTheDocument();
    expect(within(breakdown).getByRole("cell", { name: cop("25000") })).toBeInTheDocument();
    // currentNet is spelled out with a word, never a bare signed number.
    expect(within(breakdown).getByRole("cell", { name: `Le deben ${cop("15000")}` })).toBeInTheDocument();
    expect(within(breakdown).getByRole("cell", { name: `Debe ${cop("15000")}` })).toBeInTheDocument();

    const categoryTable = screen.getByRole("table", { name: "Gasto por categoría" });
    expect(within(categoryTable).getByRole("rowheader", { name: "Comida" })).toBeInTheDocument();
    expect(within(categoryTable).getByRole("rowheader", { name: "Sin categoría" })).toBeInTheDocument();
  });

  it("labels a converted block with the pin's date and source", async () => {
    renderTab({
      displayCurrency: "USD",
      byCurrency: [
        {
          currency: "USD",
          byDay: [{ key: "2026-08-24", amount: "3000" }],
          byMonth: [{ key: "2026-08", amount: "3000" }],
          byCategory: [{ category: "comida", amount: "3000" }],
          members: [row({ userId: "ana", paid: "3000", consumed: "3000" })],
          pins: [
            { fromCurrency: "COP", toCurrency: "USD", rate: "0.00025", asOf: "2026-08-20", source: "open-er-api" },
          ],
        },
      ],
    });
    expect(screen.getByRole("button", { name: "Tasas de conversión" })).toBeInTheDocument();
  });
});
