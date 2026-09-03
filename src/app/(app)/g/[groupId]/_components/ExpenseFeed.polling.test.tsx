import { act, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LIVE_REFRESH_INTERVAL_MS } from "../../../../../lib/query/liveGroupQuery";
import { ExpenseFeed } from "./ExpenseFeed";
import {
  feedExpense as expense,
  feedMembers as members,
  renderWithClient,
  stubEveryPage,
} from "./expenseFeedTestHelpers";
import type { ExpenseSummary } from "./types";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

function renderFeed(items: ExpenseSummary[]) {
  return renderWithClient(
    <ExpenseFeed
      groupId="g1"
      myUserId="ana"
      initialItems={items}
      initialCursor={null}
      members={members}
      defaultCurrency="COP"
    />,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("ExpenseFeed polling (T117)", () => {
  it("shows an expense another member added, without a reload", async () => {
    stubEveryPage([expense("e2", "Cena"), expense("e1", "Hotel")]);
    vi.useFakeTimers();
    renderFeed([expense("e1", "Hotel")]);
    expect(screen.queryByText("Cena")).not.toBeInTheDocument();

    await act(() => vi.advanceTimersByTimeAsync(LIVE_REFRESH_INTERVAL_MS));
    await act(() => vi.advanceTimersByTimeAsync(10));

    expect(screen.getByText("Cena")).toBeInTheDocument();
  });

  /**
   * The failure mode that would make polling worse than staleness: someone
   * is halfway through adding an expense at a restaurant table when the
   * feed refreshes under them.
   *
   * The refresh is driven by invalidating the key rather than by advancing
   * the clock — it is the same background refetch a tick performs, and
   * `userEvent` and fake timers deadlock on Base UI's dialog. The test above
   * is what proves the timer itself fires.
   */
  it("leaves a half-filled expense form alone when the feed refreshes underneath it", async () => {
    stubEveryPage([expense("e2", "Cena"), expense("e1", "Hotel")]);
    const client = renderFeed([expense("e1", "Hotel")]);

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Agregar gasto" }));
    await user.type(await screen.findByLabelText("Título"), "Almuerzo");
    await user.type(screen.getByLabelText("Monto"), "45.000");

    await act(async () => {
      await client.invalidateQueries({ queryKey: ["group", "g1", "expenses", ""] });
    });

    // The refresh landed...
    expect(await screen.findByText("Cena")).toBeInTheDocument();
    // ...and the form is untouched: still open, still holding what was typed.
    expect(screen.getByLabelText("Título")).toHaveValue("Almuerzo");
    expect(screen.getByLabelText("Monto")).toHaveValue("45.000");
  });
});
