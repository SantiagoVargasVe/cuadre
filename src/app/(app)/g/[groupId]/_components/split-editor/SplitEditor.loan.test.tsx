import { screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { lastCall, renderOpenEditor } from "./splitEditorTestHelpers";

describe("SplitEditor — loan", () => {
  it("defaults the beneficiary to the first member and resolves the full amount to them", async () => {
    const { onChange, user } = await renderOpenEditor(3000000n);
    await user.click(screen.getByRole("radio", { name: "Préstamo" }));

    await waitFor(() =>
      expect(lastCall(onChange)).toEqual([{ strategy: "loan", to: "ana" }, true]),
    );
    expect(screen.getByText("Préstamo a Ana")).toBeInTheDocument();
  });

  it("switches the beneficiary and resolves the full amount to them alone", async () => {
    const { onChange, user } = await renderOpenEditor(3000000n);
    await user.click(screen.getByRole("radio", { name: "Préstamo" }));
    await user.click(screen.getByRole("radio", { name: "Beto" }));

    await waitFor(() =>
      expect(lastCall(onChange)).toEqual([{ strategy: "loan", to: "beto" }, true]),
    );
    expect(screen.getByText("Préstamo a Beto")).toBeInTheDocument();
  });

  it("offers every member as a possible beneficiary, not just the checked ones", async () => {
    const { user } = await renderOpenEditor();
    await user.click(screen.getByRole("checkbox", { name: "Caro" })); // uncheck for equal
    await user.click(screen.getByRole("radio", { name: "Préstamo" }));

    expect(screen.getByRole("radio", { name: "Caro" })).toBeInTheDocument();
  });
});
