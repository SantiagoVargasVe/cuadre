"use client";

import { es } from "../../../../../lib/i18n/es";
import { DialogContent, DialogRoot, DialogTitle, DialogTrigger } from "../../../../_ui/Dialog";
import type { PlanEdgeView } from "./balancesTypes";
import { planEdgePhrase } from "./planPhrase";

const t = es.balances;

export interface PaymentPlanRowProps {
  edge: PlanEdgeView;
  currency: string;
  myUserId: string;
  nameOf: (userId: string) => string;
}

/**
 * One "who pays whom" line. A simplified edge is only ever a plain
 * sentence if it has nothing to explain — as soon as `explains[]` is
 * non-empty, tapping it must reveal the raw debts it replaced
 * (splitting.md § 5 *The social caveat*), so it becomes a dialog trigger
 * instead of static text.
 */
export function PaymentPlanRow({ edge, currency, myUserId, nameOf }: PaymentPlanRowProps) {
  const phrase = planEdgePhrase(edge, currency, myUserId, nameOf);
  const explains = edge.explains ?? [];

  if (explains.length === 0) {
    return <p className="text-sm text-foreground">{phrase}</p>;
  }

  return (
    <DialogRoot>
      <DialogTrigger
        className="w-full rounded-md border border-border p-2 text-left text-sm text-foreground hover:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        render={<button type="button" />}
      >
        {phrase}
      </DialogTrigger>
      <DialogContent>
        <DialogTitle className="text-lg font-semibold text-foreground">{t.explainTitle}</DialogTitle>
        <div className="mt-4 flex flex-col gap-3 text-sm text-foreground">
          <p className="font-medium">{phrase}</p>
          <div>
            <p className="text-muted-foreground">{t.explainReplaces}</p>
            <ul className="mt-1 flex flex-col gap-1">
              {explains.map((raw) => (
                <li key={`${raw.from}-${raw.to}`}>{planEdgePhrase(raw, currency, myUserId, nameOf)}</li>
              ))}
            </ul>
          </div>
        </div>
      </DialogContent>
    </DialogRoot>
  );
}
