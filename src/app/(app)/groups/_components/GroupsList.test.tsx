import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { GroupsList } from "./GroupsList";
import type { MyGroupSummary } from "./types";

/** Intl's `es-CO` currency literal uses a non-breaking space (U+00A0). */
const NBSP = " ";

function group(overrides: Partial<MyGroupSummary> = {}): MyGroupSummary {
  return {
    id: "g1",
    title: "Cartagena 2026",
    archivedAt: null,
    memberCount: 3,
    yourNet: [],
    ...overrides,
  };
}

describe("GroupsList", () => {
  it("renders the empty state when there are no groups", () => {
    render(<GroupsList groups={[]} />);
    expect(screen.getByText("Aún no tienes grupos")).toBeInTheDocument();
  });

  it("renders one line per currency and never a combined total", () => {
    render(
      <GroupsList
        groups={[
          group({
            yourNet: [
              { currency: "COP", net: "2000000" },
              { currency: "USD", net: "-500" },
            ],
          }),
        ]}
      />,
    );

    expect(screen.getByText(`+$${NBSP}20.000`)).toBeInTheDocument();
    expect(screen.getByText(`-$${NBSP}5,00`)).toBeInTheDocument();
    // Nothing should render a value summing across the two currencies —
    // there's no shared unit for 20.000 COP and 5 USD to add up in.
    expect(screen.queryByText(/total/i)).not.toBeInTheDocument();
  });

  it("separates archived groups into their own section", () => {
    render(
      <GroupsList
        groups={[group({ id: "active", title: "Activo" }), group({ id: "old", title: "Viejo", archivedAt: "2026-01-01T00:00:00Z" })]}
      />,
    );

    expect(screen.getByText("Archivados")).toBeInTheDocument();
    expect(screen.getByText("Activo")).toBeInTheDocument();
    expect(screen.getByText("Viejo")).toBeInTheDocument();
  });

  it("shows a settled indicator for a group with no ledger activity", () => {
    render(<GroupsList groups={[group({ yourNet: [] })]} />);
    expect(screen.getByText("En ceros")).toBeInTheDocument();
  });
});
