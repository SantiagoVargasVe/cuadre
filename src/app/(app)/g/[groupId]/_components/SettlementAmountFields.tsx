"use client";

import * as React from "react";
import {
  Controller,
  type Control,
  type UseFormGetValues,
  type UseFormRegister,
  type UseFormSetValue,
  type UseFormWatch,
} from "react-hook-form";
import { es } from "../../../../../lib/i18n/es";
import { formatAmountInput, parseAmountInput } from "../../../../../lib/money/format";
import { MoneyField } from "../../../../_ui/MoneyField";
import { SelectContent, SelectItem, SelectRoot, SelectTrigger, SelectValue } from "../../../../_ui/Select";
import { TransferHint } from "./TransferHint";
import type { SettlementFormValues } from "./settlementFormSchema";

const t = es.settlements.form;

export interface SettlementAmountFieldsProps {
  groupId: string;
  control: Control<SettlementFormValues>;
  register: UseFormRegister<SettlementFormValues>;
  watch: UseFormWatch<SettlementFormValues>;
  setValue: UseFormSetValue<SettlementFormValues>;
  getValues: UseFormGetValues<SettlementFormValues>;
  /** Currencies actually in the group — not every supported code (T104). */
  currencies: string[];
  amountError?: string;
}

/** Currency select + amount, side by side. Switching currency re-formats the
 * typed value under the new rules (COP takes no decimals, USD/EUR two) rather
 * than silently reinterpreting it, and drives the transfer-amount helper. */
export function SettlementAmountFields({
  groupId,
  control,
  register,
  watch,
  setValue,
  getValues,
  currencies,
  amountError,
}: SettlementAmountFieldsProps) {
  const currency = watch("currency");
  const rawAmount = watch("amount");

  const amountMinor = React.useMemo(() => {
    try {
      return parseAmountInput(rawAmount ?? "", currency);
    } catch {
      return 0n;
    }
  }, [rawAmount, currency]);

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-end gap-2">
        <MoneyField
          label={t.amountLabel(currency)}
          currency={currency}
          className="flex-1"
          error={amountError}
          {...register("amount")}
        />
        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium text-foreground">{t.currencyLabel}</span>
          <Controller
            name="currency"
            control={control}
            render={({ field }) => (
              <SelectRoot
                value={field.value}
                onValueChange={(v) => {
                  if (!v) return;
                  setValue("amount", formatAmountInput(getValues("amount"), v), { shouldValidate: true });
                  field.onChange(v);
                }}
              >
                <SelectTrigger aria-label={t.currencyLabel} className="w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {currencies.map((code) => (
                    <SelectItem key={code} value={code}>
                      {code}
                    </SelectItem>
                  ))}
                </SelectContent>
              </SelectRoot>
            )}
          />
        </div>
      </div>
      <TransferHint groupId={groupId} fromCurrency={currency} amountMinor={amountMinor} />
    </div>
  );
}
