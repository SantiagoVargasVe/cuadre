import { describe, expect, it } from "vitest";
import { block, copyPlan } from "./paymentPlanTestHelpers";

/** The converted read path: one block in the display currency, carrying
 * the pins every amount in it leans on (services/balances.ts). */
describe("formatPaymentPlanForClipboard — converted (T116)", () => {
  it("says the amounts are converted and carries each pin's provenance", () => {
    const text = copyPlan({
      displayCurrency: "COP",
      byCurrency: [
        block({
          plan: [{ from: "beto", to: "ana", amount: "2000000" }],
          pins: [
            {
              fromCurrency: "USD",
              toCurrency: "COP",
              rate: "4123.45678900",
              asOf: "2026-08-30",
              source: "open-er-api",
            },
            {
              fromCurrency: "EUR",
              toCurrency: "COP",
              rate: "4500.00000000",
              asOf: "2026-08-30",
              source: "open-er-api",
            },
          ],
        }),
      ],
    });

    expect(text).toBe(
      "Plan de pagos — Cartagena 2026\n\n" +
        "COP\nBeto le paga a Ana $\u00a020.000\n\n" +
        "Montos convertidos a COP con tasas fijas:\n" +
        "USD → COP: 4123.45678900 · tasa del 30 de ago de 2026 · open-er-api\n" +
        "EUR → COP: 4500.00000000 · tasa del 30 de ago de 2026 · open-er-api",
    );
  });

  it("passes the pinned rate through as the exact decimal string it arrived as", () => {
    // More significant digits than a double can hold, so a round trip
    // through Number would be visible in the output.
    const rate = "4123.4567890123456789";
    const text = copyPlan({
      displayCurrency: "USD",
      byCurrency: [
        block({
          currency: "USD",
          plan: [{ from: "beto", to: "ana", amount: "3050" }],
          pins: [
            { fromCurrency: "COP", toCurrency: "USD", rate, asOf: "2026-08-30", source: "trm" },
          ],
        }),
      ],
    });

    expect(text).toContain(`COP → USD: ${rate} · tasa del`);
    // The hazard this guards against: the same rate through a double is a
    // different rate (currency.md § *Pinned rates*).
    expect(String(Number(rate))).not.toBe(rate);
  });

  it("adds no conversion note when the group is not converted", () => {
    const text = copyPlan({
      displayCurrency: null,
      byCurrency: [block({ plan: [{ from: "beto", to: "ana", amount: "2000000" }] })],
    });

    expect(text).not.toContain("convertidos");
  });
});
