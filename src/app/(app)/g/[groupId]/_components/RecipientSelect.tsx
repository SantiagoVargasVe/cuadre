"use client";

import { Controller, type Control } from "react-hook-form";
import { es } from "../../../../../lib/i18n/es";
import {
  SelectContent,
  SelectItem,
  selectItems,
  SelectRoot,
  SelectTrigger,
  SelectValue,
} from "../../../../_ui/Select";
import type { SettlementFormValues } from "./settlementFormSchema";
import type { GroupMember } from "./types";

const t = es.settlements.form;

/** "¿A quién le pagaste?" — the item value is a `userId`, so `items` feeds
 * the closed trigger a name instead of the raw id (T103). */
export function RecipientSelect({
  control,
  recipients,
}: {
  control: Control<SettlementFormValues>;
  recipients: GroupMember[];
}) {
  const items = selectItems(recipients, (m) => m.userId, (m) => m.displayName);

  return (
    <div className="flex flex-col gap-1">
      <span className="text-sm font-medium text-foreground">{t.toLabel}</span>
      <Controller
        name="toUserId"
        control={control}
        render={({ field }) => (
          <SelectRoot items={items} value={field.value} onValueChange={field.onChange}>
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
  );
}
