import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CategoryBadge } from "./CategoryBadge";

describe("CategoryBadge", () => {
  it("shows the Spanish label for a known key", () => {
    render(<CategoryBadge categoryKey="alojamiento" />);
    expect(screen.getByText("Alojamiento")).toBeInTheDocument();
  });

  it("renders nothing for an uncategorised expense", () => {
    const { container } = render(<CategoryBadge categoryKey={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing for an unknown key rather than a raw string", () => {
    const { container } = render(<CategoryBadge categoryKey="food" />);
    expect(container).toBeEmptyDOMElement();
  });
});
