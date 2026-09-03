"use client";

import * as React from "react";
import { es } from "../../../../../lib/i18n/es";
import { Button } from "../../../../_ui/Button";

const t = es.balances.copyPlan;

/**
 * Hands the plan over as text (T116). `text` is derived from the balances
 * query on every render, so a simplify toggle or a recorded settlement
 * changes what the next press copies — nothing is captured at mount.
 *
 * A rejected clipboard write is reported, never swallowed into a success
 * state: claiming "¡Copiado!" over an empty clipboard is worse than the
 * error, because the next thing the user does is paste.
 */
export function CopyPaymentPlanButton({ text }: { text: string }) {
  const [state, setState] = React.useState<"idle" | "copied" | "error">("idle");

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setState("copied");
    } catch {
      setState("error");
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <Button type="button" variant="secondary" className="min-h-11" onClick={copy}>
        {t.action}
      </Button>
      {/* Present from first render so the announcement is a change to a
          live region, not a region appearing with text already in it. */}
      <p role="status" aria-live="polite" className="text-sm text-muted-foreground">
        {state === "copied" ? t.copied : ""}
      </p>
      {state === "error" && (
        <p role="alert" className="text-sm text-destructive">
          {t.error}
        </p>
      )}
    </div>
  );
}
