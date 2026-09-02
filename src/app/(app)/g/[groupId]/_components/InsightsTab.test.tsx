import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { formatMoney } from "../../../../../lib/money/format";
import { InsightsTab } from "./InsightsTab";
import type { InsightsResult } from "./insightsTypes";
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

describe("InsightsTab", () => {
  it("shows a calm empty state when there is nothing to analyse", () => {
    renderTab({ displayCurrency: null, byCurrency: [] });
    expect(screen.getByText("Aún no hay nada que analizar")).toBeInTheDocument();
    expect(screen.queryByRole("figure")).not.toBeInTheDocument();
  });

  it("renders each chart's numbers as a hidden table, with member ids resolved to names", () => {
    renderTab({
      displayCurrency: null,
      byCurrency: [
        {
          currency: "COP",
          byDay: [{ key: "2026-08-24", amount: "40000" }],
          byMonth: [{ key: "2026-08", amount: "40000" }],
          byMember: [
            { userId: "beto", amount: "25000" },
            { userId: "ana", amount: "15000" },
          ],
          byCategory: [
            { category: "comida", amount: "30000" },
            { category: null, amount: "10000" },
          ],
        },
      ],
    });

    const memberTable = screen.getByRole("table", { name: "Gasto por persona" });
    expect(within(memberTable).getByRole("rowheader", { name: "Beto" })).toBeInTheDocument();
    expect(within(memberTable).getByRole("cell", { name: cop("25000") })).toBeInTheDocument();
    expect(within(memberTable).getByRole("rowheader", { name: "Ana" })).toBeInTheDocument();

    const categoryTable = screen.getByRole("table", { name: "Gasto por categoría" });
    expect(within(categoryTable).getByRole("rowheader", { name: "Comida" })).toBeInTheDocument();
    expect(within(categoryTable).getByRole("rowheader", { name: "Sin categoría" })).toBeInTheDocument();
    expect(within(categoryTable).getByRole("cell", { name: cop("10000") })).toBeInTheDocument();
  });

  it("labels a converted block with the pin's date and source", async () => {
    renderTab({
      displayCurrency: "USD",
      byCurrency: [
        {
          currency: "USD",
          byDay: [{ key: "2026-08-24", amount: "3000" }],
          byMonth: [{ key: "2026-08", amount: "3000" }],
          byMember: [{ userId: "ana", amount: "3000" }],
          byCategory: [{ category: "comida", amount: "3000" }],
          pins: [
            { fromCurrency: "COP", toCurrency: "USD", rate: "0.00025", asOf: "2026-08-20", source: "open-er-api" },
          ],
        },
      ],
    });
    expect(screen.getByRole("button", { name: "Tasas de conversión" })).toBeInTheDocument();
  });
});
