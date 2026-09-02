import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ExpenseHistory } from "./ExpenseHistory";
import type { ExpenseRevisionsResult } from "./revisionTypes";

afterEach(() => vi.unstubAllGlobals());

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });
}

const oneCreation: ExpenseRevisionsResult = {
  revisions: [
    {
      version: 1,
      action: "created",
      changedAt: "2026-08-24T12:00:00.000Z",
      changedBy: { userId: "ana", displayName: "Ana" },
      changes: [],
    },
  ],
};

function renderHistory() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <ExpenseHistory expenseId="expense-1" />
    </QueryClientProvider>,
  );
  return userEvent.setup();
}

describe("ExpenseHistory", () => {
  it("starts collapsed and fetches nothing until it is opened", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    renderHistory();

    expect(screen.getByText("Historial").closest("details")).not.toHaveAttribute("open");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("loads the revisions on first expand and shows the creation entry", async () => {
    const fetchMock = vi.fn(async () => jsonResponse(oneCreation));
    vi.stubGlobal("fetch", fetchMock);
    const user = renderHistory();

    await user.click(screen.getByText("Historial"));

    expect(await screen.findByText(/Ana creó el gasto/)).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith("/api/expenses/expense-1/revisions", expect.anything());
  });
});
