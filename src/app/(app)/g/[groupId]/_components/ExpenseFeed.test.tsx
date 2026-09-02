import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ExpenseFeed } from "./ExpenseFeed";
import type { ExpenseSummary, GroupMember } from "./types";

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

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ExpenseFeed", () => {
  it("renders the empty state when there are no expenses", () => {
    render(
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

    render(
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
    render(
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

    render(
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
