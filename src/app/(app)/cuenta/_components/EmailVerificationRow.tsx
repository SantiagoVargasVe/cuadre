"use client";

import { es } from "../../../../lib/i18n/es";
import { isRateLimited, useMe, useResendVerification } from "../../../_shell/useMe";
import { Button } from "../../../_ui/Button";

const t = es.account.security.email;

/**
 * The account holder's own verification state and a resend control. Reads
 * the shared `["me"]` query — no extra request. Verification state is
 * never rendered for anyone else, anywhere (ADR-0013).
 */
export function EmailVerificationRow() {
  const { data } = useMe();
  const resend = useResendVerification();

  if (!data) return null;
  const verified = data.user.emailVerified;

  const status = resend.isSuccess
    ? t.resent
    : resend.isError
      ? isRateLimited(resend.error)
        ? t.rateLimited
        : t.error
      : null;

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-foreground">
          {verified ? t.verifiedLabel : t.unverifiedLabel}
        </p>
        {!verified && (
          <Button
            size="sm"
            variant="secondary"
            disabled={resend.isPending || resend.isSuccess}
            onClick={() => resend.mutate()}
          >
            {resend.isPending ? t.resending : t.resend}
          </Button>
        )}
      </div>
      {!verified && <p className="text-sm text-muted-foreground">{t.unverifiedHint}</p>}
      {status && (
        <p role="status" className="text-sm text-muted-foreground">
          {status}
        </p>
      )}
    </div>
  );
}
