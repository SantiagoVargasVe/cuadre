import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CurrencySwitcher } from "./CurrencySwitcher";
import type { DisplayCurrencyState } from "./groupSettingsTypes";

afterEach(() => vi.unstubAllGlobals());

function renderSwitcher(initial: DisplayCurrencyState, fetchMock = vi.fn()) {
  vi.stubGlobal("fetch", fetchMock);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <CurrencySwitcher groupId="g1" initial={initial} />
    </QueryClientProvider>,
  );
  return { user: userEvent.setup(), fetchMock };
}

describe("CurrencySwitcher", () => {
  it("names the rate's date and source in a confirmation before writing anything", async () => {
    const { user, fetchMock } = renderSwitcher({ currency: null, pins: [], source: "open-er-api" });

    await user.click(screen.getByRole("button", { name: "Convertir" }));

    // Provenance is shown, and nothing has been written yet.
    expect(await screen.findByText(/Se fijará la tasa de open-er-api del/)).toBeInTheDocument();
    expect(screen.getByText("Todos los miembros verán los montos convertidos.")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();

    // Confirming issues the PUT.
    await user.click(screen.getAllByRole("button", { name: "Convertir" }).at(-1)!);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/groups/g1/display-currency");
    expect(init.method).toBe("PUT");
    expect(JSON.parse(init.body as string)).toEqual({ currency: "COP" });
  });

  it("shows the revert and re-pin controls, and the pin provenance, whenever a display currency is set", () => {
    renderSwitcher({
      currency: "USD",
      source: "open-er-api",
      pins: [{ fromCurrency: "COP", toCurrency: "USD", rate: "0.00032649", asOf: "2026-08-26", source: "open-er-api" }],
    });

    expect(screen.getByText("El grupo se muestra en USD.")).toBeInTheDocument();
    expect(screen.getByText(/COP → USD: 0\.00032649 · tasa del .* · open-er-api/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Volver a monedas originales" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Volver a fijar tasas de hoy" })).toBeInTheDocument();
  });
});
