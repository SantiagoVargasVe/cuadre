import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { ExpenseForm } from "./ExpenseForm";
import { todayIso } from "./expenseFormSchema";
import type { ExpenseSummary, GroupMember } from "./types";

/** Shared fixtures for ExpenseForm.test.tsx and ExpenseForm.payers.test.tsx
 * — split across two files because one grew past the 100-line test-file
 * limit (eslint.config.mjs). */

export const members: GroupMember[] = [
  { userId: "ana", displayName: "Ana", role: "owner" },
  { userId: "beto", displayName: "Beto", role: "member" },
];

export const detailResponse: ExpenseSummary = {
  id: "e1",
  title: "Cena",
  date: todayIso(),
  total: { amount: "10000000", currency: "COP" },
  payers: [{ userId: "ana", amount: "10000000", displayName: "Ana" }],
  splits: [
    { userId: "ana", amount: "5000000", displayName: "Ana" },
    { userId: "beto", amount: "5000000", displayName: "Beto" },
  ],
  strategy: "equal",
  category: null,
  converted: null,
  editedAt: null,
  editedBy: null,
};

export function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

export function stubCreateThenFetch(): ReturnType<typeof vi.fn> {
  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce(jsonResponse(201, { id: "e1" }))
    .mockResolvedValueOnce(jsonResponse(200, detailResponse));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

export function renderForm(onCreated = vi.fn()) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const invalidateSpy = vi.spyOn(client, "invalidateQueries");
  render(
    <QueryClientProvider client={client}>
      <ExpenseForm groupId="g1" members={members} defaultCurrency="COP" myUserId="ana" onCreated={onCreated} />
    </QueryClientProvider>,
  );
  return { onCreated, invalidateSpy };
}

export async function fillTitleAndAmount(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText("Título"), "Cena");
  await user.type(screen.getByLabelText("Monto"), "100000");
}
