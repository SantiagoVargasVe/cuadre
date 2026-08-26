import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { PayerEditor } from "./PayerEditor";
import type { GroupMember } from "./types";

const members: GroupMember[] = [
  { userId: "ana", displayName: "Ana", role: "owner" },
  { userId: "beto", displayName: "Beto", role: "member" },
];

describe("PayerEditor", () => {
  it("collapses to 'Pagado por: tú' by default", () => {
    render(
      <PayerEditor
        members={members}
        myUserId="ana"
        currency="COP"
        totalAmount={10000000n}
        value={null}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByText("Pagado por: tú")).toBeInTheDocument();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  });

  it("expands to show every member as a checkbox when tapped", async () => {
    const user = userEvent.setup();
    render(
      <PayerEditor
        members={members}
        myUserId="ana"
        currency="COP"
        totalAmount={10000000n}
        value={null}
        onChange={vi.fn()}
      />,
    );

    await user.click(screen.getByText("Pagado por: tú"));

    expect(screen.getByRole("checkbox", { name: "Ana" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Beto" })).not.toBeChecked();
  });

  it("does not show an amount field while only one payer is selected", async () => {
    const user = userEvent.setup();
    render(
      <PayerEditor
        members={members}
        myUserId="ana"
        currency="COP"
        totalAmount={10000000n}
        value={null}
        onChange={vi.fn()}
      />,
    );
    await user.click(screen.getByText("Pagado por: tú"));

    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("reports the second payer once checked, with a zero starting amount", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(
      <PayerEditor
        members={members}
        myUserId="ana"
        currency="COP"
        totalAmount={10000000n}
        value={null}
        onChange={onChange}
      />,
    );
    await user.click(screen.getByText("Pagado por: tú"));

    await user.click(screen.getByRole("checkbox", { name: "Beto" }));

    expect(onChange).toHaveBeenCalledWith(
      expect.arrayContaining([
        { userId: "ana", amount: 0n },
        { userId: "beto", amount: 0n },
      ]),
    );
  });

  it("shows a summary of names once more than one payer is selected", () => {
    render(
      <PayerEditor
        members={members}
        myUserId="ana"
        currency="COP"
        totalAmount={10000000n}
        value={[
          { userId: "ana", amount: 5000000n },
          { userId: "beto", amount: 5000000n },
        ]}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByText("Pagado por: Ana, Beto")).toBeInTheDocument();
  });
});
