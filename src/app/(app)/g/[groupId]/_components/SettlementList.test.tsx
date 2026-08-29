import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { members } from "./balancesTestHelpers";
import { SettlementList } from "./SettlementList";
import { mockSettlements } from "./settlementsTestHelpers";
import type { SettlementView } from "./settlementTypes";

const paid: SettlementView = {
  id: "s1",
  fromUserId: "beto",
  toUserId: "ana",
  amount: "5000000",
  currency: "COP",
  settledOn: "2026-08-20",
  note: "Efectivo",
};

describe("SettlementList", () => {
  it("shows a calm empty state when nothing is recorded", () => {
    render(<SettlementList members={members} myUserId="ana" mutations={mockSettlements([])} />);
    expect(screen.getByText("Aún no hay pagos registrados.")).toBeInTheDocument();
  });

  it("renders a recorded payment with its amount, date, note, and edit/delete controls", () => {
    render(<SettlementList members={members} myUserId="ana" mutations={mockSettlements([paid])} />);

    expect(screen.getByText("Beto le pagó a Ana")).toBeInTheDocument();
    expect(screen.getByText("$ 50.000")).toBeInTheDocument();
    expect(screen.getByText("Efectivo")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Editar" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Eliminar" })).toBeInTheDocument();
  });
});
