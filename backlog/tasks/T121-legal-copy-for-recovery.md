---
id: T121
title: Terms and Privacy — email delivery and self-service recovery
epic: E15-account-recovery
status: blocked
depends_on: []
size: S
---

## Context

Two published legal documents become false the moment this epic sends its first message, and they
are versioned, acknowledged, and recorded per user (T118). The Terms currently promise:

> "Cuadre no verifica el correo electrónico y actualmente no ofrece recuperación automática de
> contraseña. Una dirección incorrecta puede impedirte recuperar el acceso."

and the Privacy Policy states that no user data is sent to the daily FX provider — accurate, but
written when that was the *only* outbound call. After
[ADR-0011](../../docs/adr/0011-outbound-email-via-smtp.md) there is a mail processor that receives
an email address.

This is a separate task rather than a criterion inside T120 for the same reason T118 was written
that way: **the copy needs Santiago's approval before it ships**, and that approval shouldn't block
the transport code from being reviewed. It does block the first send — T124 depends on this task.

Read [T118](T118-legal-acknowledgements.md) (especially its *Out of scope*),
[src/lib/legal.ts](../../src/lib/legal.ts), [ADR-0011](../../docs/adr/0011-outbound-email-via-smtp.md)
§ *What this costs the privacy posture*, and ADR-0013's note that verification status is private.

**Do not invent legal promises, describe a regulatory regime, or claim compliance.** Describe what
the software actually does after this epic, in Spanish, and get it approved before merging.

## Acceptance criteria

- [ ] Terms § *Cuenta e invitaciones* rewritten to describe reality after this epic: Cuadre sends a
      verification message at registration, an unverified address can still use the app in full,
      and self-service password recovery requires a verified address. Keep the honest warning that
      a wrong address limits recovery — it is still true, it just has a different remedy now
      (the operator-minted link, T128)
- [ ] Privacy Policy updated to name the email processor category and be exact about what it
      receives: an address and a link, on registration, on a reset request for a verified address,
      and on an explicit resend. It receives no group name, member list, amount, or balance. The
      FX sentence stays true and stays
- [ ] Both documents' `version` and `effectiveDate` bumped in `src/lib/legal.ts` — the single
      source of truth the pages render from and registration records. One edit, both places
- [ ] The copy states that verification status is visible only to the account holder, never to
      co-members (ADR-0013)
- [ ] **No re-acknowledgement flow.** Existing accounts keep their prior-version records; the
      natural key on `legal_acceptances` retains them, and new registrations record the new
      versions automatically. T118 deliberately built no re-prompt, and adding one here would be a
      second feature inside a recovery epic — if it is ever wanted it belongs to E14 with its own
      task
- [ ] No migration and no backfill. This task changes copy and two version labels
- [ ] Tests: the public `/terms` and `/privacy` routes render the new versions; the version labels
      the pages display match what registration records (the existing T118 tests should already
      pin this — extend rather than duplicate)
- [ ] Santiago has approved the Spanish copy before merge, and the PR says so

## Out of scope

Any code that sends mail (T120, T124, T125). Re-acknowledgement prompts, consent banners, cookie
notices, marketing-email preferences. Adding IP, user-agent, or client-clock evidence to
acknowledgement records — T118 ruled that out and nothing here changes it. Translating either
document.

## Files likely touched

```
src/lib/legal.ts
src/lib/i18n/legal-es.ts
src/app/(legal)/**
```
