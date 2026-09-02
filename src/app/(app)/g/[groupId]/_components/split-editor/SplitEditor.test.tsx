import { screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderOpenEditor } from "./splitEditorTestHelpers";

/** `\s` rather than a literal space — Intl's `es-CO` currency literal
 * uses a non-breaking space (U+00A0), not U+0020. */
const RESOLVED_33_OR_34 = /^\$\s3[34]$/;

describe("SplitEditor — equal / equal_subset", () => {
  it("starts collapsed with the plain equal split", async () => {
    const { controller } = await renderOpenEditor();
    expect(controller().splitInput).toEqual({ strategy: "equal" });
    expect(controller().preview).not.toBeNull();
  });

  it("shows every member checked and their resolved share", async () => {
    // 100 COP minor units isn't divisible by 3 pesos evenly, so the
    // leftover peso is visible even after COP's 0-decimal display rounds
    // away anything smaller. (splitting.md § 3.2's own worked example,
    // 10.000.000 minor units, differs only in the centavo place, which
    // COP's display hides entirely — it wouldn't prove anything here.)
    await renderOpenEditor(10000n);
    expect(screen.getByRole("checkbox", { name: "Ana" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Beto" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Caro" })).toBeChecked();
    expect(screen.getAllByText(RESOLVED_33_OR_34)).toHaveLength(3);
  });

  it("switches to equal_subset once a member is unchecked, updating the summary", async () => {
    const { controller, user } = await renderOpenEditor();
    await user.click(screen.getByRole("checkbox", { name: "Caro" }));

    await waitFor(() =>
      expect(controller().splitInput).toEqual({ strategy: "equal_subset", members: ["ana", "beto"] }),
    );
    expect(screen.getByText("Dividido: entre 2 personas")).toBeInTheDocument();
  });

  it("never allows unchecking the last remaining member", async () => {
    const { user } = await renderOpenEditor();
    for (const name of ["Beto", "Caro"]) {
      await user.click(screen.getByRole("checkbox", { name }));
    }
    await user.click(screen.getByRole("checkbox", { name: "Ana" }));

    expect(screen.getByRole("checkbox", { name: "Ana" })).toBeChecked();
  });

  it("shows nothing resolved while the total is zero", async () => {
    await renderOpenEditor(0n);
    expect(screen.queryByText(/^\$/)).not.toBeInTheDocument();
  });
});
