import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ExpenseFeed } from "./ExpenseFeed";
import {
  feedExpense as expense,
  feedMembers as members,
  jsonResponse,
  renderWithClient,
} from "./expenseFeedTestHelpers";

// The feed renders the search/filter bar, which navigates (T115).
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

afterEach(() => {
  vi.unstubAllGlobals();
});


describe("ExpenseFeed", () => {
  it("renders the empty state when there are no expenses", () => {
    renderWithClient(
      <ExpenseFeed
        groupId="g1"
        myUserId="ana"
        initialItems={[]}
        initialCursor={null}
        members={members}
        defaultCurrency="COP"
      />,
    );
    expect(screen.getByText("Aún no hay gastos")).toBeInTheDocument();
  });

  it("renders the server-provided first page without a network call", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    renderWithClient(
      <ExpenseFeed
        groupId="g1"
        myUserId="ana"
        initialItems={[expense("e1", "Cena")]}
        initialCursor={null}
        members={members}
        defaultCurrency="COP"
      />,
    );

    expect(screen.getByText("Cena")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("hides 'load more' once there's no next cursor", () => {
    renderWithClient(
      <ExpenseFeed
        groupId="g1"
        myUserId="ana"
        initialItems={[expense("e1", "Cena")]}
        initialCursor={null}
        members={members}
        defaultCurrency="COP"
      />,
    );
    expect(screen.queryByRole("button", { name: "Cargar más" })).not.toBeInTheDocument();
  });

  it("appends the next page without duplicating existing rows", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(200, { items: [expense("e2", "Almuerzo")], nextCursor: null }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();

    renderWithClient(
      <ExpenseFeed
        groupId="g1"
        myUserId="ana"
        initialItems={[expense("e1", "Cena")]}
        initialCursor="cursor-1"
        members={members}
        defaultCurrency="COP"
      />,
    );

    await user.click(screen.getByRole("button", { name: "Cargar más" }));

    await waitFor(() => expect(screen.getByText("Almuerzo")).toBeInTheDocument());
    expect(screen.getByText("Cena")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /Cena|Almuerzo/ })).toHaveLength(2);
    expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/groups/g1/expenses?cursor=cursor-1");
    // The cursor from the new page was null, so "load more" disappears.
    expect(screen.queryByRole("button", { name: "Cargar más" })).not.toBeInTheDocument();
  });
});
