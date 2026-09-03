import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BarSeries } from "./BarSeries";

describe("BarSeries", () => {
  it("keeps multi-row labels and exact large values available to the user", () => {
    render(
      <BarSeries
        title="Gasto por categoría"
        description="Dos categorías y sus gastos"
        bars={[
          {
            label: "Categoría con un nombre deliberadamente muy largo para una pantalla estrecha",
            value: 999999999,
            valueText: "$ 9.999.999",
          },
          { label: "Transporte", value: 180000, valueText: "$ 180.000" },
        ]}
      />,
    );

    expect(screen.getByRole("img", { name: "Gasto por categoría" })).toBeInTheDocument();
    expect(screen.getByText("Categoría con un nombre deliberadamente muy largo para una pantalla estrecha")).toBeInTheDocument();
    expect(screen.getByText("Transporte")).toBeInTheDocument();
    expect(screen.getByText("$ 9.999.999")).toBeInTheDocument();
    expect(screen.getByText("$ 180.000")).toBeInTheDocument();
  });
});
