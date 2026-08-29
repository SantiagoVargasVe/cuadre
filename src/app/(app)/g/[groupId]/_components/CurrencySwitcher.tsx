"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "../../../../../lib/api/client";
import { formatCalendarDate } from "../../../../../lib/date/format";
import { es } from "../../../../../lib/i18n/es";
import { KNOWN_CURRENCIES } from "../../../../../lib/money/format";
import { Button } from "../../../../_ui/Button";
import { SelectContent, SelectItem, SelectRoot, SelectTrigger, SelectValue } from "../../../../_ui/Select";
import { ConvertCurrencyDialog } from "./ConvertCurrencyDialog";
import type { DisplayCurrencyState } from "./groupSettingsTypes";

const t = es.settings.currency;

/**
 * The currency switcher lives **here**, in Ajustes — not the header. It
 * re-pins rates and changes every member's view, so it must not read as a
 * personal view preference (frontend/CLAUDE.md § *Multi-currency display*).
 */
export function CurrencySwitcher({ groupId, initial }: { groupId: string; initial: DisplayCurrencyState }) {
  const queryClient = useQueryClient();
  const [target, setTarget] = React.useState(initial.currency ?? KNOWN_CURRENCIES[0]!);
  const { data } = useQuery({
    queryKey: ["group", groupId, "display-currency"],
    queryFn: () => apiFetch<DisplayCurrencyState>(`/api/groups/${groupId}/display-currency`),
    initialData: initial,
    staleTime: Infinity,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["group", groupId] });
  const put = useMutation({
    mutationFn: (currency: string) =>
      apiFetch(`/api/groups/${groupId}/display-currency`, { method: "PUT", body: { currency } }),
    onSuccess: invalidate,
  });
  const revert = useMutation({
    mutationFn: () => apiFetch(`/api/groups/${groupId}/display-currency`, { method: "DELETE" }),
    onSuccess: invalidate,
  });
  const pending = put.isPending || revert.isPending;

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
      <h2 className="text-sm font-semibold text-foreground">{t.heading}</h2>
      <p className="text-sm text-muted-foreground">{t.body}</p>

      {data.currency ? (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-foreground">{t.currentlyIn(data.currency)}</p>
          <ul className="flex flex-col gap-1 text-xs text-muted-foreground">
            {data.pins.map((pin) => (
              <li key={`${pin.fromCurrency}-${pin.toCurrency}`}>
                {t.pinLine(pin.fromCurrency, pin.toCurrency, pin.rate, formatCalendarDate(pin.asOf), pin.source)}
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="ghost" disabled={pending} onClick={() => revert.mutate()}>
              {t.revert}
            </Button>
            <ConvertCurrencyDialog
              trigger={<Button type="button" variant="secondary">{t.repin}</Button>}
              mode="repin"
              currency={data.currency}
              source={data.source}
              pending={pending}
              onConfirm={() => put.mutate(data.currency!)}
            />
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <SelectRoot value={target} onValueChange={(v) => v && setTarget(v)}>
            <SelectTrigger aria-label={t.targetLabel}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {KNOWN_CURRENCIES.map((code) => (
                <SelectItem key={code} value={code}>{code}</SelectItem>
              ))}
            </SelectContent>
          </SelectRoot>
          <ConvertCurrencyDialog
            trigger={<Button type="button">{t.convert}</Button>}
            mode="convert"
            currency={target}
            source={data.source}
            pending={pending}
            onConfirm={() => put.mutate(target)}
          />
        </div>
      )}
      {(put.isError || revert.isError) && <p role="alert" className="text-sm text-destructive">{t.error}</p>}
    </section>
  );
}
