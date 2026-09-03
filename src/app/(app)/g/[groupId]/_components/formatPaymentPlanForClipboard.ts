import { formatCalendarDate } from "../../../../../lib/date/format";
import { es } from "../../../../../lib/i18n/es";
import { formatMoney } from "../../../../../lib/money/format";
import type { BalancesResult, CurrencyBalancesView } from "./balancesTypes";

const t = es.balances.copyPlan;
const pinLine = es.settings.currency.pinLine;

export interface FormatPaymentPlanInput {
  groupTitle: string;
  balances: BalancesResult;
  /** The group's own `userId` → name lookup, so the copied text says
   * exactly what the plan rows on screen say — including the `?` a name
   * the member list can't resolve already shows there. */
  nameOf: (userId: string) => string;
}

/**
 * Turns the payment plan currently on screen into Spanish text ready to
 * paste into WhatsApp (T116).
 *
 * Presentation only. It never derives, nets, converts, sums, or reorders
 * money — the server's plan is the plan (ADR-0006: simplification is
 * derived at read time and is the server's answer, not the client's).
 * Wording is neutral third person on purpose: the same message has to be
 * correct for every member who reads it, not just whoever copied it.
 */
export function formatPaymentPlanForClipboard({
  groupTitle,
  balances,
  nameOf,
}: FormatPaymentPlanInput): string {
  const blocks = balances.byCurrency.filter((block) => block.plan.length > 0);
  if (blocks.length === 0) return "";

  const sections = [t.heading(groupTitle), ...blocks.map((block) => currencyBlock(block, nameOf))];

  // Only the converted read path sets a display currency, and then there is
  // at most one block — but the pins are read off the blocks either way
  // rather than assumed (services/balances.ts § getConvertedBalances).
  const conversion = conversionNote(balances, blocks);
  if (conversion) sections.push(conversion);

  return sections.join("\n\n");
}

/** One currency's edges under its own heading. Blocks are never summed and
 * never merged — a total across currencies would be a fiction
 * (frontend/CLAUDE.md § *Multi-currency display*). */
function currencyBlock(block: CurrencyBalancesView, nameOf: (userId: string) => string): string {
  const lines = block.plan.map((edge) =>
    // `explains[]` stays in the app: the shared message is the actionable
    // plan, not the audit trail behind it.
    t.edge(
      nameOf(edge.from),
      nameOf(edge.to),
      formatMoney({ amount: BigInt(edge.amount), currency: block.currency }),
    ),
  );
  return [block.currency, ...lines].join("\n");
}

/**
 * Converted amounts have to say so, and carry the provenance of every rate
 * they lean on — a plan pasted into a chat outlives the screen it came
 * from. The rate is the API's decimal string, passed straight through: a
 * round trip via `Number` is exactly how a pinned rate stops being the
 * rate that was pinned (currency.md § *Pinned rates*).
 */
function conversionNote(balances: BalancesResult, blocks: CurrencyBalancesView[]): string | null {
  if (!balances.displayCurrency) return null;

  const pins = blocks.flatMap((block) => block.pins ?? []);
  if (pins.length === 0) return null;

  return [
    t.convertedNote(balances.displayCurrency),
    ...pins.map((pin) =>
      pinLine(
        pin.fromCurrency,
        pin.toCurrency,
        pin.rate,
        formatCalendarDate(pin.asOf),
        pin.source,
      ),
    ),
  ].join("\n");
}
