import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CurrencySwitcher } from "./CurrencySwitcher";
import type { DisplayCurrencyState } from "./groupSettingsTypes";

afterEach(() => vi.unstubAllGlobals());

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

/** Handles the balances + fx-quote GETs the switcher now fires; records
 * every write so a test can assert nothing was written before confirm. */
function stubFetch(quotes: Record<string, unknown> = { USD: { rate: "0.00032649", asOf: "2026-08-30", source: "open-er-api" } }) {
  const writes: { url: string; method: string; body: unknown }[] = [];
  const mock = vi.fn(async (url: string, init?: RequestInit) => {
    const method = init?.method ?? "GET";
    if (method !== "GET") {
      writes.push({ url, method, body: init?.body ? JSON.parse(init.body as string) : undefined });
      return jsonResponse(200, { group: {} });
    }
    if (url.includes("/balances")) return jsonResponse(200, { byCurrency: [{ currency: "COP" }, { currency: "USD" }] });
    if (url.includes("/fx-quote")) {
      const from = new URL(url, "http://x").searchParams.get("from")!;
      const q = quotes[from];
      return q ? jsonResponse(200, q) : jsonResponse(422, { error: { code: "RATE_UNAVAILABLE", message: "no" } });
    }
    return jsonResponse(200, {});
  });
  vi.stubGlobal("fetch", mock);
  return { mock, writes };
}

function renderSwitcher(initial: DisplayCurrencyState) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <CurrencySwitcher groupId="g1" initial={initial} />
    </QueryClientProvider>,
  );
  return userEvent.setup();
}

describe("CurrencySwitcher (T105)", () => {
  it("explains that converting changes derived numbers for everyone, is reversible, and then freezes", () => {
    stubFetch();
    renderSwitcher({ currency: null, pins: [], source: "open-er-api" });

    expect(screen.getByText(/recalcula los montos, los balances y el plan de pago/)).toBeInTheDocument();
    expect(screen.getByText(/Aplica a todos los miembros/)).toBeInTheDocument();
    expect(screen.getByText(/Es reversible/)).toBeInTheDocument();
    expect(screen.getByText(/Volver a fijar las tasas es la única acción/)).toBeInTheDocument();
  });

  it("previews the rate it will pin per currency pair — source and date — and writes nothing until confirmed", async () => {
    const { writes } = stubFetch();
    const user = renderSwitcher({ currency: null, pins: [], source: "open-er-api" });

    await user.click(screen.getByRole("button", { name: "Convertir" }));

    expect(await screen.findByText("Tasas que se van a fijar")).toBeInTheDocument();
    expect(screen.getByText(/USD → COP: 0\.00032649 · open-er-api, 30 de ago de 2026/)).toBeInTheDocument();
    expect(screen.getByText(/Se fijará la tasa de open-er-api del/)).toBeInTheDocument();
    expect(writes).toHaveLength(0);

    await user.click(screen.getAllByRole("button", { name: "Convertir" }).at(-1)!);
    await waitFor(() => expect(writes).toHaveLength(1));
    expect(writes[0]).toMatchObject({ url: "/api/groups/g1/display-currency", method: "PUT", body: { currency: "COP" } });
  });

  it("marks a pair with no rate today rather than hiding it", async () => {
    stubFetch({}); // no quote for any currency → RATE_UNAVAILABLE
    const user = renderSwitcher({ currency: null, pins: [], source: "open-er-api" });

    await user.click(screen.getByRole("button", { name: "Convertir" }));
    expect(await screen.findByText(/USD → COP: sin tasa disponible hoy/)).toBeInTheDocument();
  });

  it("keeps the pin provenance visible once converted, with a revert as prominent as convert", () => {
    stubFetch();
    renderSwitcher({
      currency: "USD",
      source: "open-er-api",
      pins: [{ fromCurrency: "COP", toCurrency: "USD", rate: "0.00032649", asOf: "2026-08-26", source: "open-er-api" }],
    });

    expect(screen.getByText("El grupo se muestra en USD.")).toBeInTheDocument();
    expect(screen.getByText(/COP → USD: 0\.00032649 · tasa del .* · open-er-api/)).toBeInTheDocument();
    const revert = screen.getByRole("button", { name: "Volver a monedas originales" });
    const repin = screen.getByRole("button", { name: "Volver a fijar tasas de hoy" });
    // Same variant class → same visual weight, not a throwaway ghost.
    expect(revert.className).toBe(repin.className);
  });
});
