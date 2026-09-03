import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LIVE_REFRESH_INTERVAL_MS } from "../../../../../lib/query/liveGroupQuery";
import type { ExpenseFilters } from "../../../../../lib/schemas/expenseFilters";
import { useExpenseFeed } from "./useExpenseFeed";
import {
  feedExpense as expense,
  queryClientWrapper,
  stubPages,
} from "./expenseFeedTestHelpers";

function setup(filters: ExpenseFilters, initialItems = [expense("e1", "Hotel Caribe")], initialCursor: string | null = null) {
  const { wrapper } = queryClientWrapper();
  return renderHook(
    () => useExpenseFeed({ groupId: "g1", initialItems, initialCursor, filters }),
    { wrapper },
  ).result;
}

afterEach(() => vi.unstubAllGlobals());

/**
 * Advance past one poll *and* let its result land. The refetch resolves on a
 * later turn of the fake clock, so advancing exactly one interval leaves the
 * new page in the cache but not yet rendered — and switching back to real
 * timers at that moment drops the pending callback entirely. Hence the
 * trailing few milliseconds.
 */
async function tick() {
  await act(() => vi.advanceTimersByTimeAsync(LIVE_REFRESH_INTERVAL_MS));
  await act(() => vi.advanceTimersByTimeAsync(10));
}

describe("useExpenseFeed first paint", () => {
  it("renders the server's page without asking for it again", () => {
    const fetchMock = stubPages({ items: [], nextCursor: null });
    const result = setup({});

    expect(result.current.items.map((i) => i.id)).toEqual(["e1"]);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

/**
 * The point of T117: somebody else's expense arrives without anyone
 * touching this device.
 */
describe("useExpenseFeed polling", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("picks up another member's expense after one interval, with no remount", async () => {
    stubPages({ items: [expense("e2", "Cena"), expense("e1", "Hotel Caribe")], nextCursor: null });
    const result = setup({});
    expect(result.current.items.map((i) => i.id)).toEqual(["e1"]);

    await tick();

    expect(result.current.items.map((i) => i.id)).toEqual(["e2", "e1"]);
  });

  it("polls with the active filters, never the unfiltered feed", async () => {
    const fetchMock = stubPages({ items: [expense("e9", "Hotel Bahía")], nextCursor: null });
    setup({ q: "hotel" });

    await tick();

    expect(fetchMock).toHaveBeenCalledWith("/api/groups/g1/expenses?q=hotel", expect.anything());
  });

  it("does not poll before the interval is up", async () => {
    const fetchMock = stubPages({ items: [], nextCursor: null });
    setup({});

    await act(() => vi.advanceTimersByTimeAsync(LIVE_REFRESH_INTERVAL_MS - 1_000));

    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("useExpenseFeed pagination", () => {
  it("keeps the pages already loaded when a poll refetches", async () => {
    stubPages(
      { items: [expense("e2", "Cena")], nextCursor: null },
      // The refetch re-reads both pages, newest first.
      { items: [expense("e1", "Hotel Caribe")], nextCursor: "cursor-1" },
      { items: [expense("e2", "Cena")], nextCursor: null },
    );
    const result = setup({}, [expense("e1", "Hotel Caribe")], "cursor-1");

    act(() => result.current.loadMore());
    await waitFor(() => expect(result.current.items.map((i) => i.id)).toEqual(["e1", "e2"]));

    vi.useFakeTimers();
    await tick();
    vi.useRealTimers();

    // Both pages re-read and both still on screen — a poll must not snap
    // someone back to the first page.
    expect(result.current.items.map((i) => i.id)).toEqual(["e1", "e2"]);
  });
});

/**
 * A write under a filter can move a row into or out of the result — a
 * retitled expense, a changed category, a new date — and only the server
 * knows which. So every write re-reads, filtered or not: one path, and the
 * list can never drift from what the server would say.
 */
describe("useExpenseFeed writes", () => {
  it("re-reads the filtered feed after a create instead of prepending", async () => {
    const fetchMock = stubPages({ items: [expense("e9", "Hotel Bahía")], nextCursor: null });
    const result = setup({ q: "hotel" });

    act(() => result.current.onCreated());

    await waitFor(() => expect(result.current.items.map((i) => i.title)).toEqual(["Hotel Bahía"]));
    expect(fetchMock).toHaveBeenCalledWith("/api/groups/g1/expenses?q=hotel", expect.anything());
  });

  it("re-reads after an edit, since the row may no longer match", async () => {
    stubPages({ items: [], nextCursor: null });
    const result = setup({ category: "comida" });

    act(() => result.current.onUpdated());

    await waitFor(() => expect(result.current.items).toEqual([]));
  });

  it("re-reads unfiltered too, rather than patching the list locally", async () => {
    const fetchMock = stubPages({ items: [expense("e2", "Cena")], nextCursor: null });
    const result = setup({});

    act(() => result.current.onDeleted());

    await waitFor(() => expect(result.current.items.map((i) => i.id)).toEqual(["e2"]));
    expect(fetchMock).toHaveBeenCalledWith("/api/groups/g1/expenses", expect.anything());
  });
});
