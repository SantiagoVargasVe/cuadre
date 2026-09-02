import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { CategoryPicker } from "./CategoryPicker";

describe("CategoryPicker", () => {
  it("renders a chip per category with its Spanish label", () => {
    render(<CategoryPicker value={null} onChange={vi.fn()} />);
    for (const label of ["Comida", "Alojamiento", "Transporte", "Mercado", "Actividades", "Otro"]) {
      expect(screen.getByRole("button", { name: label })).toBeInTheDocument();
    }
  });

  it("selects a category on click", async () => {
    const onChange = vi.fn();
    render(<CategoryPicker value={null} onChange={onChange} />);
    await userEvent.setup().click(screen.getByRole("button", { name: "Transporte" }));
    expect(onChange).toHaveBeenCalledWith("transporte");
  });

  it("marks the selected chip pressed and clears it when tapped again", async () => {
    const onChange = vi.fn();
    render(<CategoryPicker value="comida" onChange={onChange} />);

    const selected = screen.getByRole("button", { name: "Quitar la categoría Comida" });
    expect(selected).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Alojamiento" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );

    await userEvent.setup().click(selected);
    expect(onChange).toHaveBeenCalledWith(null);
  });
});
