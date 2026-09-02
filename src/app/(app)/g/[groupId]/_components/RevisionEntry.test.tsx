import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RevisionEntry } from "./RevisionEntry";

describe("RevisionEntry", () => {
  it("renders an entry without an actor when changedBy is null", () => {
    render(
      <RevisionEntry
        revision={{
          version: 1,
          action: "created",
          changedAt: "2026-08-24T12:00:00.000Z",
          changedBy: null,
          changes: [],
        }}
      />,
    );

    expect(screen.getByText(/Alguien creó el gasto/)).toBeInTheDocument();
  });

  it("renders a deleted revision as a deletion, not a diff", () => {
    render(
      <RevisionEntry
        revision={{
          version: 3,
          action: "deleted",
          changedAt: "2026-08-26T09:00:00.000Z",
          changedBy: { userId: "ana", displayName: "Ana" },
          changes: [],
        }}
      />,
    );

    expect(screen.getByText(/Ana eliminó el gasto/)).toBeInTheDocument();
  });

  it("renders a creation as 'creó el gasto', not a diff against nothing", () => {
    render(
      <RevisionEntry
        revision={{
          version: 1,
          action: "created",
          changedAt: "2026-08-24T12:00:00.000Z",
          changedBy: { userId: "ana", displayName: "Ana" },
          changes: [],
        }}
      />,
    );

    expect(screen.getByText(/Ana creó el gasto/)).toBeInTheDocument();
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });

  it("passes before and after amounts to Money rather than rendering minor units", () => {
    render(
      <RevisionEntry
        revision={{
          version: 2,
          action: "updated",
          changedAt: "2026-08-24T12:00:00.000Z",
          changedBy: { userId: "ana", displayName: "Ana" },
          changes: [
            {
              kind: "money",
              field: "totalAmount",
              from: { amount: "15000000", currency: "COP" },
              to: { amount: "8645", currency: "USD" },
            },
          ],
        }}
      />,
    );

    expect(screen.getByText("$ 150.000")).toBeInTheDocument();
    expect(screen.getByText("US$ 86,45")).toBeInTheDocument();
    expect(screen.queryByText("15000000")).not.toBeInTheDocument();
  });
});
