import { es } from "../../../../lib/i18n/es";
import { Button } from "../../../_ui/Button";

const t = es.account.security;

/** A deliberately inert section (T109). Changing a password or an email
 * both need a mail story this deployment doesn't have yet — roadmap.md
 * § E11 — so /cuenta shows where they will live rather than pretending
 * they're missing by oversight. Disabled, not hidden, on purpose: the
 * design-system rule about absent-not-disabled is about *permissions*,
 * and this is unbuilt for everyone. */
export function SecuritySection() {
  return (
    <section className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
      <h2 className="text-sm font-semibold text-foreground">{t.heading}</h2>
      <p className="text-sm text-muted-foreground">{t.body}</p>
      <div className="flex justify-end">
        <Button type="button" variant="ghost" disabled>
          {t.changePassword}
        </Button>
      </div>
    </section>
  );
}
