import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RevisionChange } from "./RevisionChange";
import type { RevisionChange as RevisionChangeValue } from "./revisionTypes";

function renderChange(change: RevisionChangeValue) {
  return render(
    <ul>
      <RevisionChange change={change} />
    </ul>,
  );
}

describe("RevisionChange", () => {
  it("renders a scalar field delta as old → new", () => {
    renderChange({ kind: "text", field: "title", from: "Cena", to: "Cena frente al mar" });
    expect(screen.getByRole("listitem")).toHaveTextContent("Cambió el título: Cena → Cena frente al mar");
  });

  it("names the member and renders both amounts through Money for a split delta", () => {
    renderChange({
      kind: "party",
      field: "splits",
      userId: "ana",
      displayName: "Ana",
      change: "changed",
      from: { amount: "30000000", currency: "COP" },
      to: { amount: "35000000", currency: "COP" },
    });
    const li = screen.getByRole("listitem");
    expect(li).toHaveTextContent("Cambió la parte de Ana");
    // Rendered by <Money>, not built inline — no raw minor units on screen.
    expect(screen.getByText("$ 300.000")).toBeInTheDocument();
    expect(screen.getByText("$ 350.000")).toBeInTheDocument();
    expect(li).not.toHaveTextContent("30000000");
  });

  it("renders each side of a currency change in its own currency", () => {
    renderChange({
      kind: "party",
      field: "splits",
      userId: "ana",
      displayName: "Ana",
      change: "changed",
      from: { amount: "30000000", currency: "COP" },
      to: { amount: "8645", currency: "USD" },
    });
    expect(screen.getByText("$ 300.000")).toBeInTheDocument();
    expect(screen.getByText("US$ 86,45")).toBeInTheDocument();
  });

  it("shows 'sin monto' for the empty side of an add or remove", () => {
    renderChange({
      kind: "party",
      field: "payers",
      userId: "beto",
      displayName: "Beto",
      change: "removed",
      from: { amount: "1000", currency: "COP" },
      to: null,
    });
    expect(screen.getByRole("listitem")).toHaveTextContent("Quitó quien pagó Beto");
    expect(screen.getByText("sin monto")).toBeInTheDocument();
  });

  it("falls back to a former-member label when the display name is gone", () => {
    renderChange({
      kind: "party",
      field: "splits",
      userId: "ghost",
      displayName: null,
      change: "removed",
      from: { amount: "1000", currency: "COP" },
      to: null,
    });
    expect(screen.getByRole("listitem")).toHaveTextContent("Miembro anterior");
  });
});
