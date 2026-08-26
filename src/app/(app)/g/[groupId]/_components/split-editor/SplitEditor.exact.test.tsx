import { screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { lastCall, renderOpenEditor } from "./splitEditorTestHelpers";

describe("SplitEditor — exact", () => {
  it("prefills an even split that already balances", async () => {
    const { onChange, user } = await renderOpenEditor(9000000n);
    await user.click(screen.getByRole("radio", { name: "Monto exacto" }));

    await waitFor(() => expect(lastCall(onChange)[1]).toBe(true));
    expect(screen.getByText("Balanceado")).toBeInTheDocument();
  });

  it("shows a live money remainder while amounts don't sum to the total", async () => {
    const { onChange, user } = await renderOpenEditor(10000000n);
    await user.click(screen.getByRole("radio", { name: "Monto exacto" }));

    const anaAmount = screen.getByRole("textbox", { name: "Ana" });
    await user.clear(anaAmount);
    await user.type(anaAmount, "1000");

    expect(await screen.findByText(/^Faltan /)).toBeInTheDocument();
    await waitFor(() => expect(lastCall(onChange)[1]).toBe(false));
  });

  it("resolves exact amounts to precisely what was typed, e.g. 42.000", async () => {
    const { onChange, user } = await renderOpenEditor(10000000n);
    await user.click(screen.getByRole("radio", { name: "Monto exacto" }));
    await user.click(screen.getByRole("checkbox", { name: "Caro" }));

    const anaAmount = screen.getByRole("textbox", { name: "Ana" });
    const betoAmount = screen.getByRole("textbox", { name: "Beto" });
    await user.clear(anaAmount);
    await user.type(anaAmount, "42000");
    await user.clear(betoAmount);
    await user.type(betoAmount, "58000");

    await waitFor(() =>
      expect(lastCall(onChange)).toEqual([
        { strategy: "exact", amounts: { ana: "4200000", beto: "5800000" } },
        true,
      ]),
    );
  });
});
