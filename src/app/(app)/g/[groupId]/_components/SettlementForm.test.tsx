import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
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

afterEach(() => vi.unstubAllGlobals());

/** `DialogClose` needs a `Dialog.Root` ancestor; `TransferHint` needs a query client. */
function renderForm(props: Partial<Parameters<typeof SettlementForm>[0]> = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const onSubmit = vi.fn();
  render(
    <QueryClientProvider client={client}>
      <DialogRoot open>
        <SettlementForm
          groupId="g1"
          members={members}
          myUserId={members[0]!.userId}
          currency="COP"
          presentCurrencies={["COP", "USD"]}
          submitting={false}
          onSubmit={onSubmit}
          {...props}
        />
      </DialogRoot>
    </QueryClientProvider>,
  );
  return { onSubmit, recipient: () => screen.getByRole("combobox", { name: "¿A quién le pagaste?" }) };
}

describe("SettlementForm recipient select (T103)", () => {
  it("shows the recipient's display name on the closed trigger, never their id", () => {
    const { recipient } = renderForm();
    expect(recipient()).toHaveTextContent("Beto");
    expect(recipient().textContent ?? "").not.toMatch(UUID);
  });

  it("keeps showing a name, not an id, after a different recipient is picked", async () => {
    const user = userEvent.setup();
    const { recipient } = renderForm();

    await user.click(recipient());
    await user.click(await screen.findByRole("option", { name: "Caro" }));

    expect(recipient()).toHaveTextContent("Caro");
    expect(recipient().textContent ?? "").not.toMatch(UUID);
  });
});

describe("SettlementForm currency select (T104)", () => {
  it("offers the currencies present in the group, defaulting to the opened context", () => {
    renderForm({ currency: "USD" });
    expect(screen.getByRole("combobox", { name: "Moneda" })).toHaveTextContent("USD");
  });

  it("submits the currency that is selected", async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm();

    await user.type(screen.getByLabelText("Monto (COP)"), "50000");
    await user.click(screen.getByRole("combobox", { name: "Moneda" }));
    await user.click(await screen.findByRole("option", { name: "USD" }));
    await user.click(screen.getByRole("button", { name: "Guardar" }));

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ currency: "USD" }));
  });

  it("re-formats the amount on a currency switch rather than reinterpreting it x100", async () => {
    const user = userEvent.setup();
    renderForm({ currency: "USD" });

    const amount = screen.getByLabelText("Monto (USD)");
    await user.type(amount, "40,50");
    await user.click(screen.getByRole("combobox", { name: "Moneda" }));
    await user.click(await screen.findByRole("option", { name: "COP" }));

    // COP has no centavos → "40,50" becomes "40", not "4.050" or "4050".
    expect(screen.getByLabelText("Monto (COP)")).toHaveValue("40");
  });
});
