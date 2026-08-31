import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DialogRoot } from "../../../../_ui/Dialog";
import { SettlementForm } from "./SettlementForm";
import type { GroupMember } from "./types";

const members: GroupMember[] = [
  { userId: "11111111-1111-4111-8111-111111111111", displayName: "Ana", role: "owner" },
  { userId: "22222222-2222-4222-8222-222222222222", displayName: "Beto", role: "member" },
];

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

afterEach(() => vi.unstubAllGlobals());

function renderUsdForm(fetchMock: ReturnType<typeof vi.fn>) {
  vi.stubGlobal("fetch", fetchMock);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <DialogRoot open>
        <SettlementForm
          groupId="g1"
          members={members}
          myUserId={members[0]!.userId}
          currency="USD"
          presentCurrencies={["COP", "USD"]}
          submitting={false}
          onSubmit={vi.fn()}
        />
      </DialogRoot>
    </QueryClientProvider>,
  );
  return userEvent.setup();
}

describe("SettlementForm transfer helper (T104)", () => {
  it("spells out the COP transfer amount with the rate's source and date", async () => {
    const user = renderUsdForm(
      vi.fn(async (url: string) => {
        if (url.includes("/fx-quote")) {
          expect(url).toContain("from=USD&to=COP");
          return jsonResponse(200, { rate: "4000.0000000000", asOf: "2026-08-31", source: "open-er-api" });
        }
        return jsonResponse(200, {});
      }),
    );

    await user.type(screen.getByLabelText("Monto (USD)"), "40");

    // 40 USD × 4000 = 160.000 COP.
    expect(await screen.findByText(/Para pagar US\$\s40,00 necesitas transferir \$\s160\.000/)).toBeInTheDocument();
    expect(screen.getByText(/tasa de open-er-api, 31 de ago de 2026/)).toBeInTheDocument();
  });

  it("hides the helper on RATE_UNAVAILABLE rather than showing a stale number", async () => {
    const user = renderUsdForm(
      vi.fn(async (url: string) => {
        if (url.includes("/fx-quote")) {
          return jsonResponse(422, {
            error: { code: "RATE_UNAVAILABLE", message: "no rate", details: { from: "USD", to: "COP", date: "2026-08-31" } },
          });
        }
        return jsonResponse(200, {});
      }),
    );

    await user.type(screen.getByLabelText("Monto (USD)"), "40");
    // Give the query a tick to settle into its error state.
    await new Promise((r) => setTimeout(r, 20));

    expect(screen.queryByText(/necesitas transferir/)).not.toBeInTheDocument();
  });

  it("shows no helper at all when the currency is COP", async () => {
    const fetchMock = vi.fn(async () => jsonResponse(200, {}));
    vi.stubGlobal("fetch", fetchMock);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <DialogRoot open>
          <SettlementForm
            groupId="g1"
            members={members}
            myUserId={members[0]!.userId}
            currency="COP"
            presentCurrencies={["COP", "USD"]}
            submitting={false}
            onSubmit={vi.fn()}
          />
        </DialogRoot>
      </QueryClientProvider>,
    );
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Monto (COP)"), "50000");

    expect(screen.queryByText(/necesitas transferir/)).not.toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalledWith(expect.stringContaining("/fx-quote"), expect.anything());
  });
});
