"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import * as React from "react";
import { useForm } from "react-hook-form";
import { ApiError } from "../../../../../lib/api/client";
import type { ExpenseCategoryKey } from "../../../../../lib/categories";
import { es } from "../../../../../lib/i18n/es";
import { parseAmountInput } from "../../../../../lib/money/format";
import type { SplitInput } from "../../../../../lib/schemas/expenses";
import { Button } from "../../../../_ui/Button";
import { TextField } from "../../../../_ui/TextField";
import { AmountCurrencyFields } from "./AmountCurrencyFields";
import { CategoryPicker } from "./CategoryPicker";
import { expenseFormSchema, todayIso, type ExpenseFormValues } from "./expenseFormSchema";
import { PayerEditor, type Payer } from "./PayerEditor";
import { SplitEditor } from "./split-editor/SplitEditor";
import { submitExpense } from "./submitExpense";
import type { ExpenseSummary, GroupMember } from "./types";

const t = es.expenseForm;

export interface ExpenseFormProps {
  groupId: string;
  members: GroupMember[];
  defaultCurrency: string;
  myUserId: string;
  onCreated: (expense: ExpenseSummary) => void;
}

/** "Title, amount, save" — that path requires no other interaction
 * (frontend/CLAUDE.md § *The expense form*). Payers default to you alone
 * and the split to `equal` among everyone. */
export function ExpenseForm({ groupId, members, defaultCurrency, myUserId, onCreated }: ExpenseFormProps) {
  const queryClient = useQueryClient();
  const amountRef = React.useRef<HTMLInputElement>(null);
  const [payers, setPayers] = React.useState<Payer[] | null>(null);
  const [split, setSplit] = React.useState<SplitInput>({ strategy: "equal" });
  const [splitValid, setSplitValid] = React.useState(true);
  const [category, setCategory] = React.useState<ExpenseCategoryKey | null>(null);
  const [formError, setFormError] = React.useState<string | null>(null);
  // A brand-new expense has no id yet — the server mints one at insert
  // time and uses it as the apportionment seed (splitting.md § 3.1). This
  // is only ever a *preview* seed: the live per-member amounts shown here
  // are guaranteed correct in total, but which member absorbs a leftover
  // minor unit on a tie can differ from what the server ultimately
  // stores, since the two seeds are never the same value for a create.
  const [previewSeed] = React.useState(() => crypto.randomUUID());

  const {
    register,
    handleSubmit,
    control,
    watch,
    formState: { errors, isSubmitting, isValid },
  } = useForm<ExpenseFormValues>({
    resolver: zodResolver(expenseFormSchema),
    mode: "onChange",
    defaultValues: { title: "", amountRaw: "", currency: defaultCurrency, date: todayIso() },
  });

  React.useEffect(() => amountRef.current?.focus(), []);

  const currency = watch("currency");
  const amountRaw = watch("amountRaw");
  const totalAmount = amountRaw ? parseAmountInput(amountRaw, currency) : 0n;
  const payersBalanced =
    !payers || payers.length <= 1 || payers.reduce((sum, p) => sum + p.amount, 0n) === totalAmount;
  const canSubmit = isValid && payersBalanced && splitValid && totalAmount > 0n && !isSubmitting;

  async function onSubmit(data: ExpenseFormValues) {
    setFormError(null);
    try {
      const expense = await submitExpense(groupId, data, payers, split, category);
      queryClient.invalidateQueries({ queryKey: ["group", groupId, "expenses"] });
      queryClient.invalidateQueries({ queryKey: ["group", groupId, "balances"] });
      onCreated(expense);
    } catch (error) {
      setFormError(error instanceof ApiError ? error.message : t.errors.generic);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="mt-4 flex flex-col gap-4" noValidate>
      <TextField label={t.titleLabel} error={errors.title?.message} {...register("title")} />
      <AmountCurrencyFields register={register} control={control} currency={currency} amountRef={amountRef} />
      <TextField label={t.dateLabel} type="date" error={errors.date?.message} {...register("date")} />
      <CategoryPicker value={category} onChange={setCategory} />
      <PayerEditor
        members={members}
        myUserId={myUserId}
        currency={currency}
        totalAmount={totalAmount}
        value={payers}
        onChange={setPayers}
      />
      <SplitEditor
        members={members}
        totalAmount={totalAmount}
        currency={currency}
        seed={previewSeed}
        onChange={(nextSplit, valid) => {
          setSplit(nextSplit);
          setSplitValid(valid);
        }}
      />
      {formError && (
        <p role="alert" className="text-sm text-destructive">
          {formError}
        </p>
      )}
      <Button type="submit" disabled={!canSubmit}>
        {isSubmitting ? t.submitting : t.submit}
      </Button>
    </form>
  );
}
