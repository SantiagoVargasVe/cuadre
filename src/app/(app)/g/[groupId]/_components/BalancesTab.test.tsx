import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { jsonResponse, renderBalancesTab, unsimplified } from "./balancesTestHelpers";
import type { BalancesResult } from "./balancesTypes";

afterEach(() => {
  vi.unstubAllGlobals();
});

const simplified: BalancesResult = {
  displayCurrency: null,
  byCurrency: [
    {
      ...unsimplified.byCurrency[0]!,
      plan: [
        {
          from: "beto",
          to: "ana",
          amount: "2000000",
          explains: [
            { from: "beto", to: "ana", amount: "1000000" },
            { from: "caro", to: "ana", amount: "1000000" },
          ],
        },
      ],
      simplified: true,
    },
  ],
};

describe("BalancesTab", () => {
  it("toggling simplify PATCHes the group and re-renders from the refetched response", async () => {
    // The PATCH invalidates the whole ["group", "g1"] key, so both the
    // balances query and the settlements list refetch under it.
    const fetchMock = vi.fn((url: string, _init?: RequestInit) => {
      if (url === "/api/groups/g1") return Promise.resolve(jsonResponse(200, { group: { id: "g1" } }));
      if (url.endsWith("/settlements")) return Promise.resolve(jsonResponse(200, { items: [], nextCursor: null }));
      return Promise.resolve(jsonResponse(200, simplified));
    });
    vi.stubGlobal("fetch", fetchMock);
    renderBalancesTab();
    const user = userEvent.setup();

    await user.click(screen.getByRole("switch"));

    const [patchUrl, patchInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(patchUrl).toBe("/api/groups/g1");
    expect(patchInit.method).toBe("PATCH");
    expect(JSON.parse(patchInit.body as string)).toEqual({ simplifyDebts: true });

    await waitFor(() =>
      expect(fetchMock.mock.calls.some(([u]) => u === "/api/groups/g1/balances")).toBe(true),
    );
    await waitFor(() => expect(screen.getByRole("switch")).toBeChecked());
  });

  it("reveals the raw debts a simplified edge replaced on tap, not before", async () => {
    renderBalancesTab(simplified);
    const user = userEvent.setup();

    expect(screen.queryByText("¿Por qué este pago?")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Beto/ }));

    expect(await screen.findByText("¿Por qué este pago?")).toBeInTheDocument();
    expect(screen.getByText("Esto reemplaza:")).toBeInTheDocument();
    expect(screen.getByText(/Caro te debe/)).toBeInTheDocument();
  });

  it("renders a mixed-currency group as separate blocks with no combined total", () => {
    const mixed: BalancesResult = {
      displayCurrency: null,
      byCurrency: [
        unsimplified.byCurrency[0]!,
        {
          currency: "USD",
          members: [
            { userId: "ana", paid: "5000", owed: "2500", net: "2500" },
            { userId: "beto", paid: "0", owed: "2500", net: "-2500" },
          ],
          plan: [{ from: "beto", to: "ana", amount: "2500" }],
          simplified: false,
        },
      ],
    };
    renderBalancesTab(mixed);

    expect(screen.getByRole("heading", { name: "COP" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "USD" })).toBeInTheDocument();
    expect(screen.queryByText(/^Total/)).not.toBeInTheDocument();
  });

  it("reads as settled with a calm zero state for a group with no activity", () => {
    renderBalancesTab({ displayCurrency: null, byCurrency: [] });

    expect(screen.getByText("Todo en ceros")).toBeInTheDocument();
  });
});
