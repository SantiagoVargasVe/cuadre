import { formatCalendarDate, formatTimestamp } from "../../../../../lib/date/format";
import { es } from "../../../../../lib/i18n/es";
import { Money } from "../../../../_ui/Money";
import { strategyPhrase } from "./strategyPhrase";
import { resolveDisplayAmounts, type ExpenseParty, type ExpenseSummary } from "./types";

const t = es.expenseFeed;

function PartyRow({ party, currency }: { party: ExpenseParty; currency: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span>{party.displayName}</span>
      <Money value={{ amount: BigInt(party.amount), currency }} />
    </div>
  );
}

/** The full split breakdown for one expense — rendered from the same
 * `payers`/`splits` arrays the feed row already has, never a second fetch. */
export function ExpenseDetail({ expense }: { expense: ExpenseSummary }) {
  const display = resolveDisplayAmounts(expense);

  return (
    <div className="mt-4 flex flex-col gap-4 text-foreground">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{formatCalendarDate(expense.date)}</span>
        <Money value={display.total} converted={display.convertedFrom} className="text-lg font-semibold" />
      </div>
      <div className="flex flex-col gap-1">
        <h3 className="text-sm font-medium text-muted-foreground">{t.payersHeading}</h3>
        {display.payers.map((payer) => (
          <PartyRow key={payer.userId} party={payer} currency={display.currency} />
        ))}
      </div>
      <div className="flex flex-col gap-1">
        <h3 className="text-sm font-medium text-muted-foreground">{t.splitsHeading}</h3>
        <p className="text-sm text-foreground">
          {strategyPhrase(expense.strategy, {
            splitCount: display.splits.length,
            loanTo: display.splits[0]?.displayName ?? "",
          })}
        </p>
        {display.splits.map((split) => (
          <PartyRow key={split.userId} party={split} currency={display.currency} />
        ))}
      </div>
      {expense.editedAt && (
        <p className="text-xs text-muted-foreground">
          {expense.editedBy
            ? t.editedBy(expense.editedBy.displayName, formatTimestamp(expense.editedAt))
            : t.editedUnknown(formatTimestamp(expense.editedAt))}
        </p>
      )}
    </div>
  );
}
