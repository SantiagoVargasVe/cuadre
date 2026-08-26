import type * as React from "react";
import { Controller, type Control, type UseFormRegister } from "react-hook-form";
import { es } from "../../../../../lib/i18n/es";
import { KNOWN_CURRENCIES } from "../../../../../lib/money/format";
import { MoneyField } from "../../../../_ui/MoneyField";
import { SelectContent, SelectItem, SelectRoot, SelectTrigger, SelectValue } from "../../../../_ui/Select";
import type { ExpenseFormValues } from "./expenseFormSchema";

const t = es.expenseForm;

export interface AmountCurrencyFieldsProps {
  register: UseFormRegister<ExpenseFormValues>;
  control: Control<ExpenseFormValues>;
  currency: string;
  amountRef: React.RefObject<HTMLInputElement | null>;
}

/** Amount and currency side by side — the amount gets initial focus on
 * open (frontend/CLAUDE.md § *The expense form*), so this owns the ref
 * that effect attaches to. */
export function AmountCurrencyFields({ register, control, currency, amountRef }: AmountCurrencyFieldsProps) {
  const amountField = register("amountRaw");

  return (
    <div className="flex gap-2">
      <MoneyField
        label={t.amountLabel}
        currency={currency}
        className="flex-1"
        {...amountField}
        ref={(node) => {
          amountField.ref(node);
          amountRef.current = node;
        }}
      />
      <div className="flex flex-col gap-1">
        <span className="text-sm font-medium text-foreground">{t.currencyLabel}</span>
        <Controller
          name="currency"
          control={control}
          render={({ field }) => (
            <SelectRoot value={field.value} onValueChange={field.onChange}>
              <SelectTrigger aria-label={t.currencyLabel} className="w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {KNOWN_CURRENCIES.map((code) => (
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
  );
}
