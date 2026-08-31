"use client";

import { useQueries } from "@tanstack/react-query";
import { apiFetch } from "../../../../../lib/api/client";
import { ApiError } from "../../../../../lib/api/errors";
import { formatCalendarDate } from "../../../../../lib/date/format";
import { es } from "../../../../../lib/i18n/es";
import type { FxQuote } from "../../../../../lib/schemas/fx";

const t = es.settings.currency;

/**
 * Lists the rate that would be pinned for each currency present in the
 * group → the chosen `target`, with its `source` and `asOf`, **before** the
 * convert PUT (T105). Reuses T104's read-only `GET /fx-quote` — this is a
 * read, it writes nothing. A pair with no rate today shows as unavailable
 * rather than being hidden, so the reader knows that currency won't convert.
 */
export function ConvertRatePreview({
  groupId,
  target,
  presentCurrencies,
}: {
  groupId: string;
  target: string;
  presentCurrencies: string[];
}) {
  const froms = presentCurrencies.filter((c) => c !== target);
  const results = useQueries({
    queries: froms.map((from) => ({
      queryKey: ["group", groupId, "fx-quote", from, target],
      queryFn: () =>
        apiFetch<FxQuote>(`/api/groups/${groupId}/fx-quote?from=${from}&to=${target}`),
      retry: false,
      staleTime: 5 * 60_000,
    })),
  });

  if (froms.length === 0) return null;
  if (results.some((r) => r.isPending)) {
    return <p className="text-xs text-muted-foreground">{t.ratePreviewLoading}</p>;
  }

  return (
    <div className="flex flex-col gap-1">
      <p className="text-xs font-medium text-foreground">{t.ratePreviewHeading}</p>
      <ul className="flex flex-col gap-0.5 text-xs text-muted-foreground">
        {froms.map((from, i) => {
          const r = results[i]!;
          const unavailable = r.error instanceof ApiError && r.error.code === "RATE_UNAVAILABLE";
          return (
            <li key={from} className={unavailable ? "text-debit" : undefined}>
              {r.data
                ? t.ratePreviewLine(from, target, r.data.rate, r.data.source, formatCalendarDate(r.data.asOf))
                : t.ratePreviewUnavailable(from, target)}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
