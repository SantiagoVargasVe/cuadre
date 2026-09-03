import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import { vi } from "vitest";
import type { ExpenseSummary, GroupMember } from "./types";

export const feedMembers: GroupMember[] = [{ userId: "ana", displayName: "Ana", role: "owner" }];

export function feedExpense(id: string, title: string): ExpenseSummary {
  return {
    id,
    title,
    date: "2026-08-24",
    total: { amount: "100000", currency: "COP" },
    payers: [{ userId: "ana", amount: "100000", displayName: "Ana" }],
    splits: [{ userId: "ana", amount: "100000", displayName: "Ana" }],
    strategy: "equal",
    category: null,
    converted: null,
    editedAt: null,
    editedBy: null,
  };
}

export function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** One page per request, in order — so a test can say "the server now
 * answers with Ana's new expense too". */
export function stubPages(...pages: { items: ExpenseSummary[]; nextCursor: string | null }[]) {
  const fetchMock = vi.fn();
  for (const page of pages) fetchMock.mockResolvedValueOnce(jsonResponse(200, page));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

/** Answers every request with the same page, however many the feed makes. */
export function stubEveryPage(items: ExpenseSummary[]) {
  const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { items, nextCursor: null }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

/** The feed reads through TanStack Query since T117, so it needs a client. */
export function renderWithClient(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
  return client;
}

export function queryClientWrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, wrapper };
}
