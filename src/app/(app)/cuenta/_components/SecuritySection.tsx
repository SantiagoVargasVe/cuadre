import { es } from "../../../../lib/i18n/es";
import { ChangePasswordForm } from "./ChangePasswordForm";
import { EmailVerificationRow } from "./EmailVerificationRow";

const t = es.account.security;

/**
 * Both halves are real now (E15). `EmailVerificationRow` shows the
 * caller's own verification state and re-sends the link (T124/T127);
 * `ChangePasswordForm` changes the password and, because that revokes
 * every session, keeps the caller signed in with a fresh cookie while
 * closing every other session (T129, ADR-0012).
 */
export function SecuritySection() {
  return (
    <section className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-sm font-semibold text-foreground">{t.heading}</h2>
        <p className="text-sm text-muted-foreground">{t.body}</p>
      </div>
      <EmailVerificationRow />
      <ChangePasswordForm />
    </section>
  );
}
