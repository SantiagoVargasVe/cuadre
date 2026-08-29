"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { es } from "../../../../../lib/i18n/es";
import type { CreateSettlementInput } from "../../../../../lib/schemas/settlements";
import { Button } from "../../../../_ui/Button";
import { DialogClose } from "../../../../_ui/Dialog";
import { MoneyField } from "../../../../_ui/MoneyField";
import { SelectContent, SelectItem, SelectRoot, SelectTrigger, SelectValue } from "../../../../_ui/Select";
import { TextField } from "../../../../_ui/TextField";
import {
  settlementFormSchema,
  toCreateInput,
  todayIso,
  type SettlementFormValues,
} from "./settlementFormSchema";
import type { GroupMember } from "./types";

const t = es.settlements.form;

export interface SettlementFormProps {
  members: GroupMember[];
  myUserId: string;
  currency: string;
  defaults?: Partial<SettlementFormValues>;
  submitting: boolean;
  onSubmit: (input: CreateSettlementInput) => void;
}

/** The settle-up fields. `fromUserId` is always the acting user (ADR-0009),
 * so it isn't here — the recipient list just excludes them. */
export function SettlementForm({ members, myUserId, currency, defaults, submitting, onSubmit }: SettlementFormProps) {
  const recipients = members.filter((m) => m.userId !== myUserId);
  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isValid },
  } = useForm<SettlementFormValues>({
    resolver: zodResolver(settlementFormSchema(currency)),
    mode: "onChange",
    defaultValues: {
      toUserId: defaults?.toUserId ?? recipients[0]?.userId ?? "",
      amount: defaults?.amount ?? "",
      settledOn: defaults?.settledOn ?? todayIso(),
      note: defaults?.note ?? "",
    },
  });

  return (
    <form onSubmit={handleSubmit((v) => onSubmit(toCreateInput(v, currency)))} className="mt-4 flex flex-col gap-4" noValidate>
      <div className="flex flex-col gap-1">
        <span className="text-sm font-medium text-foreground">{t.toLabel}</span>
        <Controller
          name="toUserId"
          control={control}
          render={({ field }) => (
            <SelectRoot value={field.value} onValueChange={field.onChange}>
              <SelectTrigger aria-label={t.toLabel}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {recipients.map((m) => (
                  <SelectItem key={m.userId} value={m.userId}>
                    {m.displayName}
                  </SelectItem>
                ))}
              </SelectContent>
            </SelectRoot>
          )}
        />
      </div>
      <MoneyField
        label={t.amountLabel(currency)}
        currency={currency}
        error={errors.amount ? t.amountNotPositive : undefined}
        {...register("amount")}
      />
      <TextField type="date" label={t.dateLabel} error={errors.settledOn?.message} {...register("settledOn")} />
      <TextField label={t.noteLabel} hint={t.noteHint} error={errors.note?.message} {...register("note")} />
      <div className="flex justify-end gap-2">
        <DialogClose render={<Button variant="ghost" type="button" />}>{t.cancel}</DialogClose>
        <Button type="submit" disabled={submitting || !isValid}>
          {submitting ? t.submitting : t.submit}
        </Button>
      </div>
    </form>
  );
}
