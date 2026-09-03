import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PairedBars } from "./PairedBars";

describe("PairedBars", () => {
  it("names paid and consumed alongside each large value for every member", () => {
    render(
      <PairedBars
        title="Pagó vs. consumió"
        description="Dos miembros"
        aLabel="Pagó"
        bLabel="Consumió"
        rows={[
          {
            label: "Santiago con un nombre deliberadamente largo para una pantalla estrecha",
            a: { value: 999999999, valueText: "$ 9.999.999" },
            b: { value: 888888888, valueText: "$ 8.888.888" },
          },
          {
            label: "Valentina",
            a: { value: 120000, valueText: "$ 120.000" },
            b: { value: 240000, valueText: "$ 240.000" },
          },
        ]}
      />,
    );

    expect(screen.getByRole("img", { name: "Pagó vs. consumió" })).toBeInTheDocument();
    expect(screen.getByText("Santiago con un nombre deliberadamente largo para una pantalla estrecha")).toBeInTheDocument();
    expect(screen.getByText("Valentina")).toBeInTheDocument();
    expect(screen.getByText("Pagó $ 9.999.999")).toBeInTheDocument();
    expect(screen.getByText("Consumió $ 8.888.888")).toBeInTheDocument();
    expect(screen.getByText("Pagó $ 120.000")).toBeInTheDocument();
    expect(screen.getByText("Consumió $ 240.000")).toBeInTheDocument();
  });
});
