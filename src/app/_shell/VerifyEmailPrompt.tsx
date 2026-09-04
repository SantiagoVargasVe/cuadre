"use client";

import * as React from "react";
import { es } from "../../lib/i18n/es";
import { Button } from "../_ui/Button";
import { isRateLimited, useMe, useResendVerification } from "./useMe";

const t = es.auth.verifyPrompt;
const DISMISS_KEY = "cuadre:verify-prompt-dismissed";

function readDismissed(): boolean {
  try {
    return sessionStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * A dismissible banner for a signed-in member who hasn't verified their
 * email. It **never blocks or overlays** anything — an unverified account
 * keeps full use of the app (ADR-0013); the only thing lost is
 * self-service password reset, which the copy says plainly.
 *
 * Reads the shell's existing `["me"]` query, so it costs no extra request.
 * Dismissal is kept in `sessionStorage` — it comes back next session, not
 * never.
 */
export function VerifyEmailPrompt() {
  const { data } = useMe();
  const [dismissed, setDismissed] = React.useState(true);
  const resend = useResendVerification();

  React.useEffect(() => setDismissed(readDismissed()), []);

  if (dismissed || !data || data.user.emailVerified) return null;

  function onDismiss() {
    try {
      sessionStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* private mode — the in-memory state below still hides it */
    }
    setDismissed(true);
  }

  const status = resend.isSuccess
    ? t.resent
    : resend.isError
      ? isRateLimited(resend.error)
        ? t.rateLimited
        : t.error
      : null;

  return (
    <div role="status" className="border-b border-border bg-muted">
      <div className="mx-auto flex max-w-2xl flex-col gap-2 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
        <p className="text-foreground">{t.body}</p>
        <div className="flex shrink-0 items-center gap-2">
          {status && <span className="text-muted-foreground">{status}</span>}
          <Button
            size="sm"
            variant="secondary"
            onClick={() => resend.mutate()}
            disabled={resend.isPending || resend.isSuccess}
          >
            {resend.isPending ? t.resending : t.resend}
          </Button>
          <Button size="sm" variant="ghost" onClick={onDismiss}>
            {t.dismiss}
          </Button>
        </div>
      </div>
    </div>
  );
}
