import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LIVE_STALE_TIME_MS } from "../../../../../lib/query/liveGroupQuery";
import { BalancesTab } from "./BalancesTab";
import { jsonResponse, members, noSettlements, unsimplified } from "./balancesTestHelpers";
import type { BalancesResult } from "./balancesTypes";

function balances(anaNet: string): BalancesResult {
  return {
    ...unsimplified,
    byCurrency: [
      {
        ...unsimplified.byCurrency[0]!,
        members: [
          { userId: "ana", paid: anaNet, owed: "0", net: anaNet },
          { userId: "beto", paid: "0", owed: anaNet, net: `-${anaNet}` },
        ],
        plan: [{ from: "beto", to: "ana", amount: anaNet }],
      },
    ],
  };
}

function renderTab(client: QueryClient, initialData: BalancesResult) {
  return render(
    <QueryClientProvider client={client}>
      <BalancesTab
        groupId="g1"
        groupTitle="Cartagena 2026"
        myUserId="ana"
        members={members}
        defaultCurrency="COP"
        initialSimplify={false}
        initialData={initialData}
        initialSettlements={noSettlements}
      />
    </QueryClientProvider>,
  );
}

afterEach(() => vi.unstubAllGlobals());

/**
 * The regression this task exists for. The `QueryClient` lives in the root
 * `Providers`, so its cache outlives tab navigation: coming back to Balances
 * re-runs the server component and re-computes the balances, but a cache
 * entry that already holds data ignores the fresh `initialData` it was
 * handed. Under `staleTime: Infinity` nothing ever corrected it, so the tab
 * showed the previous visit's numbers until the entry was garbage-collected
 * five idle minutes later — which is why it looked intermittent.
 */
describe("BalancesTab staleness (T117)", () => {
  it("corrects a cached balance from a previous visit instead of rendering it forever", async () => {
    vi.useFakeTimers();
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    // First visit: Beto owes Ana $ 20.000.
    const first = renderTab(client, balances("2000000"));
    expect(screen.getAllByLabelText(/20\.000/).length).toBeGreaterThan(0);
    first.unmount();

    // Long enough for the entry to go stale, nowhere near long enough for
    // it to be garbage-collected — the window in which this used to be
    // silently wrong.
    await act(() => vi.advanceTimersByTimeAsync(LIVE_STALE_TIME_MS + 1_000));

    // Away from the tab somebody records a payment, so the server now says
    // $ 7.000 — both in the re-rendered page and over the wire.
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, balances("700000"))));
    renderTab(client, balances("700000"));
    await act(() => vi.advanceTimersByTimeAsync(10));

    expect(screen.getAllByLabelText(/7\.000/).length).toBeGreaterThan(0);
    expect(screen.queryAllByLabelText(/20\.000/)).toHaveLength(0);
    vi.useRealTimers();
  });
});
