import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { InsightsTab } from "./InsightsTab";
import { block, members, result, row } from "./insightsTestData";
import type { InsightsResult } from "./insightsTypes";

function renderTab(initialData: InsightsResult) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><InsightsTab groupId="g1" members={members} initialData={initialData} /></QueryClientProvider>);
}

describe("InsightsTab", () => {
  it("shows a calm empty state when there is nothing to analyse", () => {
    renderTab(result());
    expect(screen.getByText("Aún no hay nada que analizar")).toBeInTheDocument();
  });

  it("keeps summary first, then contributions and spending categories, without a one-period evolution", () => {
    renderTab(result(block({ members: [row({ userId: "ana", paid: "40000", consumed: "40000" }), row({ userId: "beto" })] })));
    expect(screen.getAllByRole("heading", { level: 3 }).map((heading) => heading.textContent)).toEqual(["Resumen", "Aportes y balance", "En qué se gastó"]);
    expect(screen.queryByRole("heading", { name: "Evolución del gasto" })).not.toBeInTheDocument();
    expect(within(screen.getByRole("table", { name: "Pagó vs. consumió" })).getByRole("rowheader", { name: "Beto" })).toBeInTheDocument();
    expect(screen.getAllByText("En ceros").length).toBeGreaterThan(0);
  });

  it("guides an all-uncategorised group back to its expenses", () => {
    renderTab(result(block({ byCategory: [{ category: null, amount: "40000" }] })));
    expect(screen.getByText(/Aún no hay gastos categorizados/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ir a Gastos" })).toHaveAttribute("href", "/g/g1");
  });

  it("summarises one named category instead of drawing a one-bar chart", () => {
    renderTab(result(block({ byCategory: [{ category: "comida", amount: "40000" }] })));
    expect(screen.getByText(/Todo el gasto está en Comida/)).toBeInTheDocument();
    expect(screen.queryByRole("img", { name: "En qué se gastó" })).not.toBeInTheDocument();
  });

  it("renders accessible multi-category and multi-period charts", () => {
    renderTab(result(block({ byDay: [{ key: "2026-08-24", amount: "10000" }, { key: "2026-08-25", amount: "30000" }] })));
    expect(screen.getByRole("img", { name: "En qué se gastó" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Evolución del gasto" })).toBeInTheDocument();
    expect(screen.getByRole("table", { name: "Evolución del gasto" })).toBeInTheDocument();
  });

  it("keeps currency blocks separate and retains the conversion-rate affordance", () => {
    renderTab(result(block(), block({ currency: "USD", pins: [{ fromCurrency: "COP", toCurrency: "USD", rate: "0.00025", asOf: "2026-08-20", source: "open-er-api" }] })));
    expect(screen.getByRole("heading", { name: "COP" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "USD" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tasas de conversión" })).toBeInTheDocument();
  });
});
