import { es } from "../../../../lib/i18n/es";
import { Button } from "../../../_ui/Button";
import { EmailVerificationRow } from "./EmailVerificationRow";

const t = es.account.security;

/**
 * Email verification is live here (E15, T124/T127) — the row below shows
 * the caller's own state and lets them re-send the link. Changing a
 * password from here is T129; until it lands the button stays disabled
 * (unbuilt for everyone, so `disabled`, not hidden — the
 * absent-not-disabled rule is about *permissions*).
 */
export function SecuritySection() {
  return (
    <section className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
      <h2 className="text-sm font-semibold text-foreground">{t.heading}</h2>
      <p className="text-sm text-muted-foreground">{t.body}</p>
      <EmailVerificationRow />
      <div className="flex justify-end">
        <Button type="button" variant="ghost" disabled>
          {t.changePassword}
        </Button>
      </div>
    </section>
  );
}
