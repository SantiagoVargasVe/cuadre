import { es } from "../../../../../lib/i18n/es";

const t = es.settings.currency;

/** The three things a reader has to understand before converting — that it
 * recalculates everything derived for *every* member, that it's reversible,
 * and that the numbers then freeze until an explicit re-pin (T105). Broken
 * into short paragraphs so it doesn't read as a wall on a phone. */
export function CurrencyExplainer() {
  return (
    <div className="flex flex-col gap-2 text-sm text-muted-foreground">
      <p>{t.explainChanges}</p>
      <p>{t.explainReversible}</p>
      <p>{t.explainFrozen}</p>
    </div>
  );
}
