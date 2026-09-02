import { screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderOpenEditor } from "./splitEditorTestHelpers";

describe("SplitEditor — percentage", () => {
  it("derives an even split summing to exactly 10000 basis points", async () => {
    const { controller, user } = await renderOpenEditor();
    await user.click(screen.getByRole("radio", { name: "Porcentaje" }));

    await waitFor(() => {
      const split = controller().splitInput;
      const sum = Object.values((split as { basisPoints: Record<string, number> }).basisPoints).reduce(
        (total, bp) => total + bp,
        0,
      );
      expect(sum).toBe(10000);
    });
  });

  it("shows a live remainder in percentage points while it doesn't sum to 100%", async () => {
    const { controller, user } = await renderOpenEditor(10000n);
    await user.click(screen.getByRole("radio", { name: "Porcentaje" }));

    const anaPercent = screen.getByRole("textbox", { name: "Ana: %" });
    await user.clear(anaPercent);
    await user.type(anaPercent, "10");
    await user.tab();

    expect(await screen.findByText(/^Falta /)).toBeInTheDocument();
    await waitFor(() => expect(controller().preview).toBeNull());
  });

  it("resolves 60/40 to exactly 6000/4000 basis points, never a float", async () => {
    const { controller, user } = await renderOpenEditor(10000n);
    await user.click(screen.getByRole("radio", { name: "Porcentaje" }));
    await user.click(screen.getByRole("checkbox", { name: "Caro" }));

    const anaPercent = screen.getByRole("textbox", { name: "Ana: %" });
    const betoPercent = screen.getByRole("textbox", { name: "Beto: %" });
    await user.clear(anaPercent);
    await user.type(anaPercent, "60");
    await user.clear(betoPercent);
    await user.type(betoPercent, "40");
    await user.tab();

    await waitFor(() =>
      expect(controller().splitInput).toEqual({ strategy: "percentage", basisPoints: { ana: 6000, beto: 4000 } }),
    );
  });
});
