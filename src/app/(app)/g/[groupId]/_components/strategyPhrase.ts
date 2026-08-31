import { es } from "../../../../../lib/i18n/es";

const t = es.expenseFeed.strategy;

/**
 * The detail dialog shows *what* each person owes; this is the *why* — how
 * the expense was divided, in words, from `expense.strategy` (T102). Spanish
 * through i18n keys, never a hardcoded string.
 *
 * `splitCount` is `splits.length`; `loanTo` is the sole split member's name
 * (a `loan` is one payer, one split member at 100% — splitting.md § 3), used
 * only for the `loan` case. An unrecognised strategy falls back rather than
 * throwing — a rendered dialog is better than a crashed one.
 */
export function strategyPhrase(
  strategy: string,
  { splitCount, loanTo }: { splitCount: number; loanTo: string },
): string {
  switch (strategy) {
    case "equal":
    case "equal_subset":
      return t.equal(splitCount);
    case "shares":
      return t.shares;
    case "percentage":
      return t.percentage;
    case "exact":
      return t.exact;
    case "loan":
      return t.loan(loanTo);
    default:
      return t.unknown;
  }
}
