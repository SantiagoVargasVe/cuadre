import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import { vi } from "vitest";
import { BalancesTab } from "./BalancesTab";
import type { BalancesResult } from "./balancesTypes";
import type { GroupMember } from "./types";

export const members: GroupMember[] = [
  { userId: "ana", displayName: "Ana", role: "owner" },
  { userId: "beto", displayName: "Beto", role: "member" },
  { userId: "caro", displayName: "Caro", role: "member" },
];

export const unsimplified: BalancesResult = {
  displayCurrency: null,
  byCurrency: [
    {
      currency: "COP",
      members: [
        { userId: "ana", paid: "3000000", owed: "1000000", net: "2000000" },
        { userId: "beto", paid: "0", owed: "1000000", net: "-1000000" },
        { userId: "caro", paid: "0", owed: "1000000", net: "-1000000" },
      ],
      plan: [
        { from: "beto", to: "ana", amount: "1000000" },
        { from: "caro", to: "ana", amount: "1000000" },
      ],
      simplified: false,
    },
  ],
};

export function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

export function renderBalancesTab(initialData: BalancesResult = unsimplified) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const invalidateSpy = vi.spyOn(client, "invalidateQueries");
  render(
    <QueryClientProvider client={client}>
      <BalancesTab groupId="g1" myUserId="ana" members={members} initialSimplify={false} initialData={initialData} />
    </QueryClientProvider>,
  );
  return { invalidateSpy };
}
