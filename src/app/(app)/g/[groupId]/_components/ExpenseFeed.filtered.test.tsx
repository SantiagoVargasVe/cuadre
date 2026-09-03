import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ExpenseFeed } from "./ExpenseFeed";
import type { ExpenseFilters } from "../../../../../lib/schemas/expenseFilters";
import type { ExpenseSummary, GroupMember } from "./types";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

const members: GroupMember[] = [{ userId: "ana", displayName: "Ana", role: "owner" }];

function expense(id: string, title: string): ExpenseSummary {
  return {
    id,
    title,
    date: "2026-08-24",
    total: { amount: "1000", currency: "COP" },
    payers: [{ userId: "ana", amount: "1000", displayName: "Ana" }],
    splits: [{ userId: "ana", amount: "1000", displayName: "Ana" }],
    strategy: "equal",
    category: null,
    converted: null,
    editedAt: null,
    editedBy: null,
  };
}

function renderFeed(filters: ExpenseFilters, items: ExpenseSummary[], cursor: string | null) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
    <ExpenseFeed
      groupId="g1"
      myUserId="ana"
      initialItems={items}
      initialCursor={cursor}
      filters={filters}
      members={members}
      defaultCurrency="COP"
    />
    </QueryClientProvider>,
  );
}

afterEach(() => vi.unstubAllGlobals());

describe("ExpenseFeed under an active filter (T115)", () => {
  it("distinguishes no matches from an empty group, and keeps the FAB", () => {
    renderFeed({ q: "hotel" }, [], null);

    expect(screen.getByText("Ningún gasto coincide")).toBeInTheDocument();
    expect(screen.queryByText("Aún no hay gastos")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Limpiar filtros" })).toHaveAttribute("href", "/g/g1");
    expect(screen.getByRole("button", { name: "Agregar gasto" })).toBeInTheDocument();
  });

  it("still shows the empty-group state when nothing is filtered", () => {
    renderFeed({}, [], null);

    expect(screen.getByText("Aún no hay gastos")).toBeInTheDocument();
    expect(screen.queryByText("Ningún gasto coincide")).not.toBeInTheDocument();
  });

  it("carries every active filter into the next page request", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ items: [expense("e2", "Hotel Bahía")], nextCursor: null }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();

    renderFeed({ q: "hotel", currency: "COP" }, [expense("e1", "Hotel Caribe")], "cursor-1");
    await user.click(screen.getByRole("button", { name: "Cargar más" }));

    await waitFor(() => expect(screen.getByText("Hotel Bahía")).toBeInTheDocument());
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "/api/groups/g1/expenses?q=hotel&currency=COP&cursor=cursor-1",
    );
    expect(screen.getByText("Hotel Caribe")).toBeInTheDocument();
  });
});
