import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { jsonResponse, renderBalancesTab, unsimplified } from "./balancesTestHelpers";
import type { BalancesResult } from "./balancesTypes";

afterEach(() => vi.unstubAllGlobals());

const COPY = "Copiar plan de pagos";

/** userEvent.setup() installs its own clipboard stub, so this has to run
 * after it — same ordering InvitePanel.test.tsx already depends on. */
function stubClipboard(user: ReturnType<typeof userEvent.setup>, writeText: ReturnType<typeof vi.fn>) {
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
  return user;
}

const simplifiedResponse: BalancesResult = {
  displayCurrency: null,
  byCurrency: [
    {
      ...unsimplified.byCurrency[0]!,
      plan: [
        {
          from: "beto",
          to: "ana",
          amount: "2000000",
          explains: [{ from: "caro", to: "ana", amount: "1000000" }],
        },
      ],
      simplified: true,
    },
  ],
};

describe("BalancesTab — copy payment plan (T116)", () => {
  it("copies the plan on screen and confirms it in a live region", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    const user = stubClipboard(userEvent.setup(), writeText);
    renderBalancesTab();

    await user.click(screen.getByRole("button", { name: COPY }));

    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("¡Copiado!"));
    expect(writeText).toHaveBeenCalledWith(
      "Plan de pagos — Cartagena 2026\n\n" +
        "COP\n" +
        "Beto le paga a Ana $ 10.000\n" +
        "Caro le paga a Ana $ 10.000",
    );
  });

  it("keeps the plan and reports the failure rather than claiming success", async () => {
    const writeText = vi.fn().mockRejectedValue(new Error("denied"));
    const user = stubClipboard(userEvent.setup(), writeText);
    renderBalancesTab();

    await user.click(screen.getByRole("button", { name: COPY }));

    expect(await screen.findByRole("alert")).toHaveTextContent("No se pudo copiar.");
    expect(screen.getByRole("status")).not.toHaveTextContent("¡Copiado!");
    expect(screen.getByRole("button", { name: COPY })).toBeInTheDocument();
  });

  it("copies the simplified plan once the toggle has refetched, not the first response", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    const user = stubClipboard(userEvent.setup(), writeText);
    const fetchMock = vi.fn(async (url: string) => {
      if (url.endsWith("/balances")) return jsonResponse(200, simplifiedResponse);
      if (url.endsWith("/settlements")) return jsonResponse(200, { items: [], nextCursor: null });
      return jsonResponse(200, { group: { id: "g1" } });
    });
    vi.stubGlobal("fetch", fetchMock);
    renderBalancesTab();

    await user.click(screen.getByRole("switch"));
    // Two unsimplified edges collapse into one; wait for the refetched
    // plan to be on screen before copying.
    await waitFor(() =>
      expect(screen.getAllByText(/Beto te debe/)).toHaveLength(1),
    );
    await user.click(screen.getByRole("button", { name: COPY }));

    await waitFor(() => expect(writeText).toHaveBeenCalled());
    expect(writeText).toHaveBeenCalledWith(
      "Plan de pagos — Cartagena 2026\n\nCOP\nBeto le paga a Ana $ 20.000",
    );
    // The audit detail behind a simplified edge stays in the app.
    expect(writeText.mock.calls[0]?.[0]).not.toContain("Caro");
  });

  it("offers no copy action for a settled group", () => {
    renderBalancesTab({ displayCurrency: null, byCurrency: [] });

    expect(screen.queryByRole("button", { name: COPY })).not.toBeInTheDocument();
  });
});
