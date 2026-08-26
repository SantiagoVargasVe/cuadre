import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { CurrencyBalanceBlock } from "./CurrencyBalanceBlock";
import type { CurrencyBalancesView } from "./balancesTypes";
import type { GroupMember } from "./types";

const members: GroupMember[] = [{ userId: "ana", displayName: "Ana", role: "owner" }];

const converted: CurrencyBalancesView = {
  currency: "COP",
  members: [{ userId: "ana", paid: "0", owed: "0", net: "0" }],
  plan: [],
  simplified: false,
  pins: [{ fromCurrency: "USD", toCurrency: "COP", rate: "3062.9576480000", asOf: "2026-08-26", source: "open-er-api" }],
};

describe("CurrencyBalanceBlock", () => {
  it("does not show a converted marker for a block with no pins", () => {
    render(<CurrencyBalanceBlock block={{ ...converted, pins: undefined }} members={members} myUserId="ana" />);
    expect(screen.queryByText("Tasas de conversión")).not.toBeInTheDocument();
  });

  it("reveals the pin's date and source on hover, reachable in one tap", async () => {
    render(<CurrencyBalanceBlock block={converted} members={members} myUserId="ana" />);
    const user = userEvent.setup();

    expect(screen.queryByText(/tasa del/)).not.toBeInTheDocument();
    await user.hover(screen.getByRole("button", { name: "Tasas de conversión" }));

    expect(await screen.findByText(/USD → COP: tasa del/)).toBeInTheDocument();
    expect(screen.getByText(/open-er-api/)).toBeInTheDocument();
  });
});
