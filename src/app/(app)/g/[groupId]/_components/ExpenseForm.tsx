"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import * as React from "react";
import { useForm } from "react-hook-form";
import { ApiError, apiFetch } from "../../../../../lib/api/client";
import { es } from "../../../../../lib/i18n/es";
import { parseAmountInput } from "../../../../../lib/money/format";
import { Button } from "../../../../_ui/Button";
import { TextField } from "../../../../_ui/TextField";
import { AmountCurrencyFields } from "./AmountCurrencyFields";
import { expenseFormSchema, todayIso, type ExpenseFormValues } from "./expenseFormSchema";
import { PayerEditor, type Payer } from "./PayerEditor";
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
 * and the split to `equal` among everyone; T065 owns the real split
 * editor, this form only ships `equal`. */
export function ExpenseForm({ groupId, members, defaultCurrency, myUserId, onCreated }: ExpenseFormProps) {
  const queryClient = useQueryClient();
  const amountRef = React.useRef<HTMLInputElement>(null);
  const [payers, setPayers] = React.useState<Payer[] | null>(null);
  const [formError, setFormError] = React.useState<string | null>(null);

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
  const canSubmit = isValid && payersBalanced && totalAmount > 0n && !isSubmitting;

  async function onSubmit(data: ExpenseFormValues) {
    setFormError(null);
    const amount = parseAmountInput(data.amountRaw, data.currency);
    try {
      const created = await apiFetch<{ id: string }>(`/api/groups/${groupId}/expenses`, {
        method: "POST",
        body: {
          title: data.title,
          date: data.date,
          amount: amount.toString(),
          currency: data.currency,
          ...(payers
            ? { paidBy: payers.map((p) => ({ userId: p.userId, amount: p.amount.toString() })) }
            : {}),
          split: { strategy: "equal" },
        },
      });
      // The list and detail endpoints share a shape (api-contract.md §
      // *Reading a list or a single expense*) — fetching the confirmed
      // record back, rather than reconstructing one from the POST
      // response and this form's own state, is what keeps this "never
      // optimistic": the row that lands in the feed is exactly what the
      // server resolved, never a guess.
      const expense = await apiFetch<ExpenseSummary>(`/api/expenses/${created.id}`);
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
      <PayerEditor
        members={members}
        myUserId={myUserId}
        currency={currency}
        totalAmount={totalAmount}
        value={payers}
        onChange={setPayers}
      />
      <p className="text-sm text-muted-foreground">{t.splitEqualAll}</p>
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
