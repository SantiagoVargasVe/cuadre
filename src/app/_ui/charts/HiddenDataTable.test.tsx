import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { HiddenDataTable } from "./HiddenDataTable";

describe("HiddenDataTable", () => {
  it("keeps the navigable table inside an sr-only clipping wrapper", () => {
    render(
      <HiddenDataTable
        caption="Pagó vs. consumió"
        columnLabels={["Persona", "Pagó", "Consumió", "Balance actual"]}
        rows={[{ label: "Ana", values: ["$ 400", "$ 250", "Le deben $ 150"] }]}
      />,
    );

    const table = screen.getByRole("table", { name: "Pagó vs. consumió" });
    expect(table).not.toHaveClass("sr-only");
    expect(table.parentElement).toHaveClass("sr-only", "overflow-hidden");
    expect(within(table).getByRole("columnheader", { name: "Balance actual" })).toBeInTheDocument();
    expect(within(table).getByRole("rowheader", { name: "Ana" })).toBeInTheDocument();
  });
});
