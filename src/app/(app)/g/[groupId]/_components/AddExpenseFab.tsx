"use client";

import { es } from "../../../../../lib/i18n/es";
import { DialogContent, DialogRoot, DialogTitle, DialogTrigger } from "../../../../_ui/Dialog";

const t = es.expenseFeed;

/**
 * "The single most-used control in the app and it does not scroll away"
 * (design-system.md § *Layout*) — fixed bottom-right, reachable one-handed.
 * The actual form is T064/T065; this is the affordance T063 owes, wired to
 * a placeholder so the control exists and is reachable before the form
 * lands.
 */
export function AddExpenseFab() {
  return (
    <DialogRoot>
      <DialogTrigger
        className="fixed bottom-6 right-6 z-40 flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={t.addExpense}
        render={<button type="button" />}
      >
        <PlusIcon />
      </DialogTrigger>
      <DialogContent>
        <DialogTitle className="text-lg font-semibold text-foreground">
          {t.comingSoon.title}
        </DialogTitle>
        <p className="mt-4 text-sm text-muted-foreground">{t.comingSoon.body}</p>
      </DialogContent>
    </DialogRoot>
  );
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 20 20" className="size-6" fill="none" aria-hidden>
      <path d="M10 3v14M3 10h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
