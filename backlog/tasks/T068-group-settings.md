---
id: T068
title: Group settings — members, invites, currency switcher
epic: E7-frontend
status: todo
depends_on: [T060, T023, T024, T053]
size: M
---

## Context

The Ajustes tab. Two of these controls affect every member's view, so the UI has to be honest
about that rather than looking like a personal preference.

Read [frontend/CLAUDE.md](../../docs/frontend/CLAUDE.md) § *Multi-currency display* and
[ADR-0007](../../docs/adr/0007-reversible-display-currency.md).

## Acceptance criteria

- [ ] Members list with roles and join dates. No email addresses anywhere
- [ ] Invite: mint a link, copy it, share it. Optimized for pasting into WhatsApp
- [ ] Remove member — owner only — with a confirmation dialog naming the person
- [ ] When removal is refused for a non-zero balance, **show the outstanding amounts** from the
      `422` details, per currency. "No puedes salir debiendo" with the numbers
- [ ] **The currency switcher lives here, not in the header.** It re-pins rates and changes what
      every member sees; it must not feel like a personal view setting
- [ ] Converting shows a confirmation naming the rate, its date, and its source before writing
- [ ] Once converted, the tab shows the pin's date and source, plus **"volver a monedas
      originales"** — reverting must be as visible as converting was
- [ ] Re-pinning is a distinct, clearly-labelled action, since it is the only thing that moves an
      already-converted group's numbers
- [ ] Rename, edit description, archive — owner only
- [ ] Tests: refused removal renders the outstanding balances; converting shows rate provenance
      before writing; the revert control is present whenever a display currency is set

## Out of scope

Per-member display currency — explicitly rejected for v1.

## Files likely touched

```
src/app/g/[groupId]/settings/page.tsx
src/app/g/[groupId]/_components/{member-list,invite-panel,currency-switcher}.tsx
```
