import { formatMoney } from "../../../../../../lib/money/format";
import { es } from "../../../../../../lib/i18n/es";
import {
  ExactAmountsDoNotBalanceError,
  PercentagesDoNotSumError,
} from "./resolve";

const t = es.splitEditor;

function formatBasisPoints(bp: bigint): string {
  const value = Number(bp) / 100;
  return value % 1 === 0 ? value.toString() : value.toFixed(2);
}

/** "A running remainder is always visible — live, not a validation error
 * on submit" (T065). Reads the exact `details` the server's own resolver
 * errors carry, rather than re-deriving the difference by hand. */
export function RemainderText({
  preview,
  error,
  currency,
}: {
  preview: Map<string, bigint> | null;
  error: unknown;
  currency: string;
}) {
  if (preview) {
    return (
      <p className="text-sm text-credit" aria-live="polite">
        {t.remainderBalanced}
      </p>
    );
  }
  if (error instanceof ExactAmountsDoNotBalanceError) {
    const text =
      error.difference > 0n
        ? t.remainderOwed(formatMoney({ amount: error.difference, currency }))
        : t.remainderExtra(formatMoney({ amount: -error.difference, currency }));
    return (
      <p className="text-sm text-debit" aria-live="polite">
        {text}
      </p>
    );
  }
  if (error instanceof PercentagesDoNotSumError) {
    const remaining = 10000n - error.sum;
    const text = remaining > 0n ? t.percentageOwed(formatBasisPoints(remaining)) : t.percentageExtra(formatBasisPoints(-remaining));
    return (
      <p className="text-sm text-debit" aria-live="polite">
        {text}
      </p>
    );
  }
  if (error) {
    return (
      <p className="text-sm text-debit" aria-live="polite">
        {t.selectAtLeastOne}
      </p>
    );
  }
  return null;
}
