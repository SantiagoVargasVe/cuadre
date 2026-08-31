import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DialogRoot } from "../../../../_ui/Dialog";
import { SettlementForm } from "./SettlementForm";
import type { GroupMember } from "./types";

/** Any v4-shaped UUID — the raw value that must never reach the screen (T103). */
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

const members: GroupMember[] = [
  { userId: "11111111-1111-4111-8111-111111111111", displayName: "Ana", role: "owner" },
  { userId: "22222222-2222-4222-8222-222222222222", displayName: "Beto", role: "member" },
  { userId: "33333333-3333-4333-8333-333333333333", displayName: "Caro", role: "member" },
];

/** `DialogClose` inside the form needs a `Dialog.Root` ancestor for context. */
function renderForm() {
  render(
    <DialogRoot open>
      <SettlementForm
        members={members}
        myUserId={members[0]!.userId}
        currency="COP"
        submitting={false}
        onSubmit={vi.fn()}
      />
    </DialogRoot>,
  );
  return screen.getByRole("combobox");
}

describe("SettlementForm recipient select (T103)", () => {
  it("shows the recipient's display name on the closed trigger, never their id", () => {
    const trigger = renderForm();
    // Ana is the payer and excluded; recipients[0] (Beto) is the default value.
    expect(trigger).toHaveTextContent("Beto");
    expect(trigger.textContent ?? "").not.toMatch(UUID);
  });

  it("keeps showing a name, not an id, after a different recipient is picked", async () => {
    const user = userEvent.setup();
    const trigger = renderForm();

    await user.click(trigger);
    await user.click(await screen.findByRole("option", { name: "Caro" }));

    expect(trigger).toHaveTextContent("Caro");
    expect(trigger.textContent ?? "").not.toMatch(UUID);
  });
});
