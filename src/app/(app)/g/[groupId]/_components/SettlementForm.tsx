"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { es } from "../../../../../lib/i18n/es";
import type { CreateSettlementInput } from "../../../../../lib/schemas/settlements";
import { Button } from "../../../../_ui/Button";
import { DialogClose } from "../../../../_ui/Dialog";
import { TextField } from "../../../../_ui/TextField";
import { RecipientSelect } from "./RecipientSelect";
import { SettlementAmountFields } from "./SettlementAmountFields";
import {
  settlementFormSchema,
  toCreateInput,
  todayIso,
  type SettlementFormValues,
} from "./settlementFormSchema";
import type { GroupMember } from "./types";

const t = es.settlements.form;

export interface SettlementFormProps {
  groupId: string;
  members: GroupMember[];
  myUserId: string;
  /** The currency the form opens in — a plan edge's block, or the group
   * default. The initial value of the select, not a fixed setting (T104). */
  currency: string;
  /** Currencies actually present in the group — what the select offers. */
  presentCurrencies: string[];
  defaults?: Partial<SettlementFormValues>;
  submitting: boolean;
  onSubmit: (input: CreateSettlementInput) => void;
}

/** The settle-up fields. `fromUserId` is always the acting user (ADR-0009),
 * so it isn't here — the recipient list just excludes them. */
export function SettlementForm({
  groupId,
  members,
  myUserId,
  currency,
  presentCurrencies,
  defaults,
  submitting,
  onSubmit,
}: SettlementFormProps) {
  const recipients = members.filter((m) => m.userId !== myUserId);
  const {
    register,
    control,
    watch,
    setValue,
    getValues,
    handleSubmit,
    formState: { errors, isValid },
  } = useForm<SettlementFormValues>({
    resolver: zodResolver(settlementFormSchema()),
    mode: "onChange",
    defaultValues: {
      toUserId: defaults?.toUserId ?? recipients[0]?.userId ?? "",
      currency: defaults?.currency ?? currency,
      amount: defaults?.amount ?? "",
      settledOn: defaults?.settledOn ?? todayIso(),
      note: defaults?.note ?? "",
    },
  });

  return (
    <form onSubmit={handleSubmit((v) => onSubmit(toCreateInput(v)))} className="mt-4 flex flex-col gap-4" noValidate>
      <RecipientSelect control={control} recipients={recipients} />
      <SettlementAmountFields
        groupId={groupId}
        control={control}
        register={register}
        watch={watch}
        setValue={setValue}
        getValues={getValues}
        currencies={Array.from(new Set([currency, ...presentCurrencies]))}
        amountError={errors.amount ? t.amountNotPositive : undefined}
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
