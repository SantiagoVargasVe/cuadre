import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import { vi } from "vitest";
import { ExpenseFeed } from "./ExpenseFeed";
import type { ExpenseDetailResult, ExpenseSummary, GroupMember } from "./types";

export const actionMembers: GroupMember[] = [
  { userId: "ana", displayName: "Ana", role: "owner" },
  { userId: "beto", displayName: "Beto", role: "member" },
];

export const actionExpense: ExpenseSummary = {
  id: "e1",
  title: "Hotel",
  date: "2026-08-24",
  total: { amount: "30000000", currency: "COP" },
  payers: [{ userId: "ana", amount: "30000000", displayName: "Ana" }],
  splits: [
    { userId: "ana", amount: "20000000", displayName: "Ana" },
    { userId: "beto", amount: "10000000", displayName: "Beto" },
  ],
  strategy: "shares",
  category: "alojamiento",
  converted: null,
  editedAt: null,
  editedBy: null,
};

export const actionDetail: ExpenseDetailResult = {
  ...actionExpense,
  version: 1,
  split: { strategy: "shares", weights: { ana: 2, beto: 1 } },
};

export function response(status: number, body?: unknown): Response {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
  });
}

/**
 * A fetch stub that answers by method and path rather than by call order.
 * Since T117 a write is followed by the feed's own re-read, so a fixed
 * queue of responses no longer lines up — and ordering was never what these
 * tests were about. Each route returns a *fresh* Response: bodies are
 * single-use.
 */
export function stubRoutes(routes: Record<string, () => Response>) {
  const fetchMock = vi.fn((url: string, init?: RequestInit) => {
    const key = `${init?.method ?? "GET"} ${String(url).split("?")[0]}`;
    const route = routes[key];
    if (!route) return Promise.reject(new Error(`unstubbed request: ${key}`));
    return Promise.resolve(route());
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

export function renderActionFeed() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const invalidate = vi.spyOn(client, "invalidateQueries");
  render(
    <QueryClientProvider client={client}>
      <ExpenseFeed groupId="g1" myUserId="ana" initialItems={[actionExpense]} initialCursor={null}
        members={actionMembers} defaultCurrency="COP" />
    </QueryClientProvider>,
  );
  return invalidate;
}
