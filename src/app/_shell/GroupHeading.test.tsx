import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { GroupHeading } from "./GroupHeading";

describe("GroupHeading", () => {
  it("renders the group's title as the page heading", () => {
    render(<GroupHeading title="Cartagena 2026" />);
    expect(screen.getByRole("heading", { name: "Cartagena 2026" })).toBeInTheDocument();
  });

  it("truncates a long title rather than wrapping the header", () => {
    render(<GroupHeading title="Un nombre de grupo larguísimo que no cabe" />);
    expect(screen.getByRole("heading")).toHaveClass("truncate");
  });
});
