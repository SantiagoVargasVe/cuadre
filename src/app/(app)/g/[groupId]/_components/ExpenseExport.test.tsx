import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ExpenseExport } from "./ExpenseExport";

describe("ExpenseExport", () => {
  it("offers every member a plain CSV download link", () => {
    render(<ExpenseExport groupId="group-1" />);
    const link = screen.getByRole("link", { name: "Exportar CSV" });
    expect(link).toHaveAttribute("href", "/api/groups/group-1/expenses.csv");
    expect(link).toHaveAttribute("download", "");
  });
});
