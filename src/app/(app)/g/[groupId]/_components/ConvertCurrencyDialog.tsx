"use client";

import * as React from "react";
import { formatCalendarDate } from "../../../../../lib/date/format";
import { es } from "../../../../../lib/i18n/es";
import { todayIso } from "./settlementFormSchema";
import { Button } from "../../../../_ui/Button";
import { DialogClose, DialogContent, DialogRoot, DialogTitle, DialogTrigger } from "../../../../_ui/Dialog";

const t = es.settings.currency;

export interface ConvertCurrencyDialogProps {
  trigger: React.ReactElement;
  /** "convert" = first switch to `currency`; "repin" = re-pin the current one. */
  mode: "convert" | "repin";
  currency: string;
  /** The FX provider the rates will be pinned from. */
  source: string;
  pending: boolean;
  onConfirm: () => void;
}

/**
 * The confirm step. Names the rate's provenance — today's date and the FX
 * `source` — **before** the write, and states plainly that this changes
 * what *every* member sees, not just the person clicking (T068).
 */
export function ConvertCurrencyDialog({ trigger, mode, currency, source, pending, onConfirm }: ConvertCurrencyDialogProps) {
  const [open, setOpen] = React.useState(false);
  const body = mode === "convert" ? t.confirmConvertBody(currency) : t.confirmRepinBody(currency);

  return (
    <DialogRoot open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent>
        <DialogTitle className="text-lg font-semibold text-foreground">
          {mode === "convert" ? t.confirmConvertTitle : t.confirmRepinTitle}
        </DialogTitle>
        <div className="mt-3 flex flex-col gap-2 text-sm text-foreground">
          <p>{body}</p>
          <p className="text-muted-foreground">{t.provenance(formatCalendarDate(todayIso()), source)}</p>
          <p className="font-medium">{t.everyoneWarning}</p>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <DialogClose render={<Button variant="ghost" type="button" />}>{t.cancel}</DialogClose>
          <Button
            type="button"
            disabled={pending}
            onClick={() => {
              onConfirm();
              setOpen(false);
            }}
          >
            {mode === "convert" ? t.confirmConvertCta : t.confirmRepinCta}
          </Button>
        </div>
      </DialogContent>
    </DialogRoot>
  );
}
