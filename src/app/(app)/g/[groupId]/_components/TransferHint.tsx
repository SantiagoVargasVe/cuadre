"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "../../../../../lib/api/client";
import { formatCalendarDate } from "../../../../../lib/date/format";
import { es } from "../../../../../lib/i18n/es";
import { convertMinorUnits, parseRateScaled } from "../../../../../lib/money/convert";
import { formatMoney, getCurrencyMeta } from "../../../../../lib/money/format";
import type { FxQuote } from "../../../../../lib/schemas/fx";

const t = es.settlements.form;

/** Bank transfers happen in COP; a payment recorded in another currency needs
 * the COP figure spelled out (T104's steer). The settlement itself still
 * records `fromCurrency` — this is a real-world note, not a second ledger
 * entry, so recording a COP transfer does not touch the USD net. */
const TRANSFER_CURRENCY = "COP";

export interface TransferHintProps {
  groupId: string;
  fromCurrency: string;
  /** The typed amount in `fromCurrency`'s minor units, `0n` while empty. */
  amountMinor: bigint;
}

export function TransferHint({ groupId, fromCurrency, amountMinor }: TransferHintProps) {
  const show = fromCurrency !== TRANSFER_CURRENCY;

  const quote = useQuery({
    queryKey: ["group", groupId, "fx-quote", fromCurrency, TRANSFER_CURRENCY],
    queryFn: () =>
      apiFetch<FxQuote>(
        `/api/groups/${groupId}/fx-quote?from=${fromCurrency}&to=${TRANSFER_CURRENCY}`,
      ),
    enabled: show,
    retry: false,
    staleTime: 5 * 60_000,
  });

  // A missing rate (`RATE_UNAVAILABLE`) or an empty amount hides the line
  // rather than showing a stale or zero number.
  if (!show || !quote.data || amountMinor <= 0n) return null;

  const transferMinor = convertMinorUnits(
    amountMinor,
    parseRateScaled(quote.data.rate),
    getCurrencyMeta(fromCurrency).exponent,
    getCurrencyMeta(TRANSFER_CURRENCY).exponent,
  );

  return (
    <p className="text-sm text-muted-foreground">
      {t.transferHint(
        formatMoney({ amount: amountMinor, currency: fromCurrency }),
        formatMoney({ amount: transferMinor, currency: TRANSFER_CURRENCY }),
      )}{" "}
      <span className="whitespace-nowrap">
        · {t.rateProvenance(quote.data.source, formatCalendarDate(quote.data.asOf))}
      </span>
    </p>
  );
}
