import { screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { lastCall, renderOpenEditor } from "./splitEditorTestHelpers";

describe("SplitEditor — shares", () => {
  it("defaults every member to 1 share and resolves an equal split", async () => {
    const { onChange, user } = await renderOpenEditor(9000000n);
    await user.click(screen.getByRole("radio", { name: "Por partes" }));

    await waitFor(() =>
      expect(lastCall(onChange)).toEqual([
        { strategy: "shares", weights: { ana: 1, beto: 1, caro: 1 } },
        true,
      ]),
    );
  });

  it("re-derives shares from the amounts when the couple counts as two", async () => {
    const { onChange, user } = await renderOpenEditor(9000000n);
    await user.click(screen.getByRole("radio", { name: "Por partes" }));

    const anaStepper = screen.getByRole("textbox", { name: "Ana: partes" });
    await user.clear(anaStepper);
    await user.type(anaStepper, "2");
    await user.tab();

    await waitFor(() =>
      expect(lastCall(onChange)).toEqual([
        { strategy: "shares", weights: { ana: 2, beto: 1, caro: 1 } },
        true,
      ]),
    );
    // 9.000.000 minor units (90.000 COP) split 2:1:1 → Ana gets half.
    expect(screen.getByText(/^\$\s45\.000$/)).toBeInTheDocument();
  });

  it("keeps the member selection when switching into shares", async () => {
    const { user } = await renderOpenEditor();
    await user.click(screen.getByRole("checkbox", { name: "Caro" }));
    await user.click(screen.getByRole("radio", { name: "Por partes" }));

    expect(screen.getByRole("checkbox", { name: "Ana" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Beto" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Caro" })).not.toBeChecked();
  });
});
