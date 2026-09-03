import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useExpenseFeed } from "./useExpenseFeed";
import type { ExpenseFilters } from "../../../../../lib/schemas/expenseFilters";
import type { ExpenseSummary } from "./types";

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

function stubServerPage(items: ExpenseSummary[]) {
  const fetchMock = vi.fn().mockResolvedValue(
    new Response(JSON.stringify({ items, nextCursor: null }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }),
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function setup(filters: ExpenseFilters, initialItems = [expense("e1", "Hotel Caribe")]) {
  return renderHook(() =>
    useExpenseFeed({ groupId: "g1", initialItems, initialCursor: null, filters }),
  ).result;
}

afterEach(() => vi.unstubAllGlobals());

/**
 * The write path under a filter. A created/edited/deleted expense can enter
 * or leave a filtered result in ways the client can't work out — the point
 * of these cases is that it doesn't try.
 */
describe("useExpenseFeed writes (T115)", () => {
  it("re-reads the first filtered page after a create instead of prepending", async () => {
    const fetchMock = stubServerPage([expense("e9", "Hotel Bahía")]);
    const result = setup({ q: "hotel" });

    act(() => result.current.onCreated(expense("e2", "Cena")));

    await waitFor(() => expect(result.current.items.map((i) => i.title)).toEqual(["Hotel Bahía"]));
    expect(fetchMock).toHaveBeenCalledWith("/api/groups/g1/expenses?q=hotel", expect.anything());
  });

  it("re-reads after an edit, since the row may no longer match", async () => {
    stubServerPage([]);
    const result = setup({ category: "comida" });

    act(() => result.current.onUpdated({ ...expense("e1", "Hotel Caribe"), title: "Cena" }));

    await waitFor(() => expect(result.current.items).toEqual([]));
  });

  it("re-reads after a delete, since a row from a later page may now fit", async () => {
    stubServerPage([expense("e5", "Hotel Bahía")]);
    const result = setup({ q: "hotel" });

    act(() => result.current.onDeleted("e1"));

    await waitFor(() => expect(result.current.items.map((i) => i.id)).toEqual(["e5"]));
  });

  it("keeps the local update — and makes no request — when nothing is filtered", async () => {
    const fetchMock = stubServerPage([]);
    const result = setup({});

    act(() => result.current.onCreated(expense("e2", "Cena")));
    expect(result.current.items.map((i) => i.id)).toEqual(["e2", "e1"]);

    act(() => result.current.onDeleted("e1"));
    expect(result.current.items.map((i) => i.id)).toEqual(["e2"]);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
