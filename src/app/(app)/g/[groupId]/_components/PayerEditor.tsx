"use client";

import * as React from "react";
import { formatAmountInputValue, formatMoney, parseAmountInput } from "../../../../../lib/money/format";
import { es } from "../../../../../lib/i18n/es";
import { Checkbox } from "../../../../_ui/Checkbox";
import { MoneyField } from "../../../../_ui/MoneyField";
import type { GroupMember } from "./types";

const t = es.expenseForm;

export interface Payer {
  userId: string;
  amount: bigint;
}

export interface PayerEditorProps {
  members: GroupMember[];
  myUserId: string;
  currency: string;
  totalAmount: bigint;
  /** `null` means the untouched default — you, alone, for the full
   * amount — which is what lets the common-case payload omit `paidBy`
   * entirely (frontend/CLAUDE.md § *The expense form*). */
  value: Payer[] | null;
  onChange: (value: Payer[] | null) => void;
}

function summaryText(value: Payer[] | null, members: GroupMember[], myUserId: string): string {
  if (!value || (value.length === 1 && value[0]!.userId === myUserId)) return t.paidByYou;
  const names = value.map((p) => members.find((m) => m.userId === p.userId)?.displayName ?? "?");
  return t.paidBySummary(names);
}

/** Collapsed by default — "two lines of text that open editors when
 * tapped, not two always-open pickers" (design-system.md § *Layout*). */
export function PayerEditor({ members, myUserId, currency, totalAmount, value, onChange }: PayerEditorProps) {
  const [open, setOpen] = React.useState(false);
  const selected = new Set(value ? value.map((p) => p.userId) : [myUserId]);

  function toggle(userId: string) {
    const next = new Set(selected);
    if (next.has(userId)) next.delete(userId);
    else next.add(userId);
    if (next.size === 0) return; // at least one payer, always
    onChange([...next].map((id) => ({ userId: id, amount: 0n })));
  }

  function setAmount(userId: string, amount: bigint) {
    onChange([...selected].map((id) => ({ userId: id, amount: id === userId ? amount : (value?.find((p) => p.userId === id)?.amount ?? 0n) })));
  }

  const remainder = selected.size > 1 ? totalAmount - (value ?? []).reduce((sum, p) => sum + p.amount, 0n) : 0n;

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="text-left text-sm text-foreground underline decoration-dotted underline-offset-2"
      >
        {summaryText(value, members, myUserId)}
      </button>
      {open && (
        <div className="flex flex-col gap-2 rounded-md border border-border p-3">
          <h3 className="text-sm font-medium text-muted-foreground">{t.payersHeading}</h3>
          {members.map((member) => (
            <div key={member.userId} className="flex items-center justify-between gap-3">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={selected.has(member.userId)} onCheckedChange={() => toggle(member.userId)} />
                {member.displayName}
              </label>
              {selected.size > 1 && selected.has(member.userId) && (
                <MoneyField
                  label=""
                  aria-label={member.displayName}
                  currency={currency}
                  className="h-8 w-32"
                  // Empty, not "0" — a pre-filled zero the user has to
                  // notice and clear first is how "1" typed into it
                  // becomes 01, not 1.
                  defaultValue={(() => {
                    const amount = value?.find((p) => p.userId === member.userId)?.amount;
                    return amount ? formatAmountInputValue(amount, currency) : "";
                  })()}
                  onChange={(event) => setAmount(member.userId, parseAmountInput(event.target.value, currency))}
                />
              )}
            </div>
          ))}
          {selected.size > 1 && (
            <p className="text-sm text-muted-foreground" aria-live="polite">
              {remainder === 0n
                ? t.remainderBalanced
                : remainder > 0n
                  ? t.remainderOwed(formatMoney({ amount: remainder, currency }))
                  : t.remainderExtra(formatMoney({ amount: -remainder, currency }))}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
