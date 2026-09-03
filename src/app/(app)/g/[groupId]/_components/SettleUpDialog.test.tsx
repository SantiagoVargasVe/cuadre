import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, waitForElementToBeRemoved } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "../../../../_ui/Toast";
import { BalancesTab } from "./BalancesTab";
import type { BalancesResult } from "./balancesTypes";
import { members } from "./balancesTestHelpers";

afterEach(() => vi.unstubAllGlobals());

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

/** ana owes beto 47.300 on the plan — the edge ana can settle. */
const owingAna: BalancesResult = {
  displayCurrency: null,
  byCurrency: [
    {
      currency: "COP",
      members: [
        { userId: "ana", paid: "0", owed: "4730000", net: "-4730000" },
        { userId: "beto", paid: "4730000", owed: "0", net: "4730000" },
      ],
      plan: [{ from: "ana", to: "beto", amount: "4730000" }],
      simplified: false,
    },
  ],
};

function renderTab(balances: BalancesResult, fetchMock: ReturnType<typeof vi.fn>) {
  vi.stubGlobal("fetch", fetchMock);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <BalancesTab
          groupId="g1"
          groupTitle="Cartagena 2026"
          myUserId="ana"
          members={members}
          defaultCurrency="COP"
          initialSimplify={false}
          initialData={balances}
          initialSettlements={{ items: [], nextCursor: null }}
        />
      </ToastProvider>
    </QueryClientProvider>,
  );
  return userEvent.setup();
}

/** [0] is the standalone button in the header, [1] is the per-edge one. */
const recordButtons = () => screen.getAllByRole("button", { name: "Registrar pago" });

describe("SettleUpDialog", () => {
  it("prefills the amount and currency from a plan edge", async () => {
    const user = renderTab(owingAna, vi.fn());
    await user.click(recordButtons()[1]!);

    // 4.730.000 minor → COP shows no centavos → 47.300.
    expect(await screen.findByLabelText("Monto (COP)")).toHaveValue("47.300");
  });

  it("accepts an over-payment: submits the larger amount and the refetched balances flip the sign", async () => {
    // ana overpays by 2.700 → the plan now points the other way.
    const flipped: BalancesResult = {
      displayCurrency: null,
      byCurrency: [{ currency: "COP", simplified: false, members: [], plan: [{ from: "beto", to: "ana", amount: "270000" }] }],
    };
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (init?.method === "POST") return Promise.resolve(jsonResponse(201, { id: "s1" }));
      if (url.endsWith("/balances")) return Promise.resolve(jsonResponse(200, flipped));
      return Promise.resolve(jsonResponse(200, { items: [], nextCursor: null }));
    });
    const user = renderTab(owingAna, fetchMock);

    await user.click(recordButtons()[1]!);
    const amount = await screen.findByLabelText("Monto (COP)");
    await user.clear(amount);
    await user.type(amount, "50000");
    await user.click(screen.getByRole("button", { name: "Guardar" }));

    await waitFor(() => {
      const post = fetchMock.mock.calls.find(([, i]) => (i as RequestInit)?.method === "POST");
      expect(post).toBeDefined();
      expect(JSON.parse((post![1] as RequestInit).body as string)).toMatchObject({
        toUserId: "beto",
        amount: "5000000",
        currency: "COP",
      });
    });
    // The refetched, flipped balances now put Beto on the owing side.
    expect(await screen.findByText(/Beto te debe/)).toBeInTheDocument();
  });

  it("rolls the optimistic row back and toasts when the write fails", async () => {
    let rejectPost: () => void = () => {};
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (init?.method === "POST") return new Promise((_res, rej) => (rejectPost = () => rej(new Error("network"))));
      if (url.endsWith("/balances")) return Promise.resolve(jsonResponse(200, owingAna));
      return Promise.resolve(jsonResponse(200, { items: [], nextCursor: null }));
    });
    const user = renderTab(owingAna, fetchMock);

    await user.click(recordButtons()[0]!);
    await user.type(await screen.findByLabelText("Monto (COP)"), "10000");
    await user.click(screen.getByRole("button", { name: "Guardar" }));

    // Added optimistically while the POST is still in flight …
    const optimisticRow = await screen.findByText("Ana le pagó a Beto");
    rejectPost();
    // … then removed when it fails, with a toast.
    await waitForElementToBeRemoved(optimisticRow);
    expect(await screen.findByText("No se pudo registrar el pago. Intenta de nuevo.")).toBeInTheDocument();
    expect(screen.getByText("Aún no hay pagos registrados.")).toBeInTheDocument();
  });
});
