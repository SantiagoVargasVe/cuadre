import { describe, expect, it } from "vitest";
import { block, copyPlan } from "./paymentPlanTestHelpers";

describe("formatPaymentPlanForClipboard (T116)", () => {
  it("names both sides in neutral third person, never 'you'", () => {
    const text = copyPlan({
      displayCurrency: null,
      byCurrency: [block({ plan: [{ from: "beto", to: "ana", amount: "2000000" }] })],
    });

    expect(text).toBe("Plan de pagos — Cartagena 2026\n\nCOP\nBeto le paga a Ana $\u00a020.000");
  });

  it("keeps the server's edge order and drops the explain detail", () => {
    const text = copyPlan({
      displayCurrency: null,
      byCurrency: [
        block({
          plan: [
            { from: "caro", to: "ana", amount: "1000000" },
            {
              from: "beto",
              to: "ana",
              amount: "2000000",
              explains: [{ from: "beto", to: "caro", amount: "2000000" }],
            },
          ],
        }),
      ],
    });

    expect(text).toBe(
      "Plan de pagos — Cartagena 2026\n\n" +
        "COP\n" +
        "Caro le paga a Ana $\u00a010.000\n" +
        "Beto le paga a Ana $\u00a020.000",
    );
  });

  it("heads every currency separately and never implies a combined total", () => {
    const text = copyPlan({
      displayCurrency: null,
      byCurrency: [
        block({ plan: [{ from: "beto", to: "ana", amount: "2000000" }] }),
        block({ currency: "USD", plan: [{ from: "ana", to: "caro", amount: "3050" }] }),
      ],
    });

    expect(text).toBe(
      "Plan de pagos — Cartagena 2026\n\n" +
        "COP\nBeto le paga a Ana $\u00a020.000\n\n" +
        "USD\nAna le paga a Caro US$\u00a030,50",
    );
  });

  it("omits a currency whose plan is empty rather than heading it", () => {
    const text = copyPlan({
      displayCurrency: null,
      byCurrency: [
        block({ currency: "EUR", plan: [] }),
        block({ currency: "USD", plan: [{ from: "ana", to: "caro", amount: "3050" }] }),
      ],
    });

    expect(text).not.toContain("EUR");
    expect(text).toBe("Plan de pagos — Cartagena 2026\n\nUSD\nAna le paga a Caro US$\u00a030,50");
  });

  it("falls back to the same placeholder the plan row on screen shows", () => {
    const text = copyPlan({
      displayCurrency: null,
      byCurrency: [block({ plan: [{ from: "quien-sea", to: "ana", amount: "2000000" }] })],
    });

    expect(text).toContain("? le paga a Ana $\u00a020.000");
  });

  it("returns nothing for a settled group, so there is no empty message to copy", () => {
    expect(copyPlan({ displayCurrency: null, byCurrency: [] })).toBe("");
    expect(copyPlan({ displayCurrency: null, byCurrency: [block({ plan: [] })] })).toBe("");
  });
});
