import { formatMoney } from "../../../../../../lib/money/format";

/** The resolved peso amount next to a member's name — shown for every
 * strategy including `equal` (T065: "resolved per-member amounts are
 * always shown"). A plain labeled span, not `<Money>`, because the label
 * has to name *whose* amount this is (frontend/CLAUDE.md § Accessibility),
 * not just render a bare number in a row. */
export function ResolvedAmount({
  amount,
  currency,
  displayName,
}: {
  amount: bigint | undefined;
  currency: string;
  displayName: string;
}) {
  if (amount === undefined) return null;
  const formatted = formatMoney({ amount, currency });
  return (
    <span className="text-sm tabular-nums text-muted-foreground" aria-label={`${displayName}: ${formatted}`}>
      {formatted}
    </span>
  );
}
