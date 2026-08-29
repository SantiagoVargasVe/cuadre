---
id: T068
title: Group settings — members, invites, currency switcher
epic: E7-frontend
status: done
depends_on: [T060, T023, T024, T053]
size: M
---

## Context

The Ajustes tab. Two of these controls affect every member's view, so the UI has to be honest
about that rather than looking like a personal preference.

Read [frontend/CLAUDE.md](../../docs/frontend/CLAUDE.md) § *Multi-currency display* and
[ADR-0007](../../docs/adr/0007-reversible-display-currency.md).

## Acceptance criteria

- [x] `MemberList` — role (Organizador/Miembro) and join date per member; renders no email
      addresses (`GET /api/groups/:id/members` never returns them; a test asserts no `@` in the DOM)
- [x] `InvitePanel` — "Crear enlace de invitación" → `POST .../invites` → a read-only URL field
      (select-on-focus) + a "Copiar" button that writes to the clipboard and confirms "¡Copiado!"
- [x] `RemoveMemberDialog` — owner-only trigger (absent, not disabled, for non-owners); the
      confirm names the person
- [x] On a `422 MEMBER_HAS_BALANCE`, the dialog swaps to "No puedes salir debiendo" + one
      `<Money signed>` line per currency from `error.details.balances`
- [x] `CurrencySwitcher` lives in Ajustes; its copy ("Cambia cómo ve los montos **todo el
      grupo**…", "Todos los miembros verán los montos convertidos") states it's group-wide
- [x] Converting goes through `ConvertCurrencyDialog` which names today's date + the FX `source`
      (new field on `GET .../display-currency`) **before** the PUT — a test asserts no `fetch`
      until the confirm is clicked
- [x] When a display currency is set: the pin line shows `from → to: rate · tasa del <date> ·
      <source>`, and "Volver a monedas originales" sits right beside it
- [x] "Volver a fijar tasas de hoy" is its own button with its own confirm (mode `"repin"`),
      wording it as the thing that moves already-converted numbers
- [x] `GroupMetaForm` (rename / description / archive) renders only for an owner
- [x] Tests (5 files, 10 cases): refused removal renders the per-currency balances; the convert
      confirm shows provenance and fires no write until confirmed; the revert + re-pin controls
      are present whenever a display currency is set; the remove control is absent for a non-owner;
      invite mint + copy

## Backend touch

`getDisplayCurrency` now also returns `source` (the provider a conversion would pin from) so the
confirm step can name provenance before the first pin exists. api-contract.md updated; the
display-currency route test asserts the new field.

## Files touched

`_components/`: `GroupSettings`, `MemberList`, `RemoveMemberDialog`, `InvitePanel`,
`CurrencySwitcher`, `ConvertCurrencyDialog`, `GroupMetaForm`, `groupSettingsTypes` + tests; edits
to `ajustes/page.tsx`, `_components/types.ts`, `i18n/es.ts`, `server/services/fx.ts`,
`api/.../display-currency/route.test.ts`, `docs/context/api-contract.md`.

## Out of scope

Per-member display currency — explicitly rejected for v1.

## Files likely touched

```
src/app/g/[groupId]/settings/page.tsx
src/app/g/[groupId]/_components/{member-list,invite-panel,currency-switcher}.tsx
```
