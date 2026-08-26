import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { Money } from "./Money";

/** Intl's `es-CO` currency literal uses a non-breaking space (U+00A0)
 * between the symbol and the number — see format.test.ts. */
const NBSP = " ";

describe("Money", () => {
  it("renders the formatted amount", () => {
    render(<Money value={{ amount: 15000000n, currency: "COP" }} />);
    expect(screen.getByText(`$${NBSP}150.000`)).toBeInTheDocument();
  });

  it("has tabular-nums so a column of amounts doesn't shift digit widths", () => {
    render(<Money value={{ amount: 15000000n, currency: "COP" }} />);
    expect(screen.getByText(`$${NBSP}150.000`)).toHaveClass("tabular-nums");
  });

  it("prefixes a positive net with + when signed", () => {
    render(<Money value={{ amount: 2000000n, currency: "COP" }} signed />);
    expect(screen.getByText(`+$${NBSP}20.000`)).toBeInTheDocument();
  });

  it("marks a converted amount and reveals the original on the tooltip trigger", async () => {
    const user = userEvent.setup();
    render(
      <Money
        value={{ amount: 7500n, currency: "USD" }}
        converted={{ original: { amount: 15000000n, currency: "COP" }, pinnedAt: "2026-08-24" }}
      />,
    );

    expect(screen.getByText(`$${NBSP}75,00`)).toBeInTheDocument();
    const marker = screen.getByRole("button", { name: "Monto convertido" });

    await user.hover(marker);

    expect(
      await screen.findByText(`Convertido de $${NBSP}150.000 el 24 de ago de 2026`),
    ).toBeInTheDocument();
  });
});
