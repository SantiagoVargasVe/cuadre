import { formatCalendarDate } from "../../../../../lib/date/format";
import { es } from "../../../../../lib/i18n/es";
import { Money } from "../../../../_ui/Money";
import { wireToMoney } from "./types";
import type { RevisionChange as RevisionChangeValue } from "./revisionTypes";

const t = es.expenseHistory;

function TextValue({ field, value }: { field: "title" | "expenseDate" | "splitStrategy" | "currency"; value: string }) {
  const rendered = field === "expenseDate" ? formatCalendarDate(value) : t.value(field, value);
  return <span className="break-words">{rendered}</span>;
}

function Amount({ value }: { value: { amount: string; currency: string } | null }) {
  return value ? <Money value={wireToMoney(value)} /> : <span>{t.none}</span>;
}

/** One server-computed field delta. Amounts always cross this component through Money. */
export function RevisionChange({ change }: { change: RevisionChangeValue }) {
  if (change.kind === "text") {
    return (
      <li className="break-words">
        {t.changed(t.field(change.field))}: <TextValue field={change.field} value={change.from} /> →{" "}
        <TextValue field={change.field} value={change.to} />
      </li>
    );
  }

  if (change.kind === "money") {
    return (
      <li>
        {t.changed(t.total)}: <Money value={wireToMoney(change.from)} /> → <Money value={wireToMoney(change.to)} />
      </li>
    );
  }

  const member = change.displayName ?? t.unknownMember;
  return (
    <li className="flex flex-wrap items-baseline gap-x-1">
      <span>{t.party(change.field, change.change, member)}:</span>
      <Amount value={change.from} />
      <span aria-hidden>→</span>
      <Amount value={change.to} />
    </li>
  );
}
