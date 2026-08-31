---
id: T105
title: Explain what "moneda de visualización" actually changes
epic: E12-first-use
status: todo
depends_on: []
size: S
---

## Context

The currency switcher in Ajustes undersells itself. Its copy says amounts will be shown in the
chosen currency, which reads like a formatting preference. What actually happens is bigger:
**every balance, every net position and the whole payment plan get recomputed** at a pinned rate,
for every member — the numbers people act on change, not just their presentation.

It also doesn't show what a reader most wants before committing: the rates it is about to pin,
per currency pair, so they can sanity-check them. The confirm dialog names the source and today's
date ([T068](T068-group-settings.md)) but not the rates themselves, and the group's own
currencies aren't listed.

This is copy and presentation only. The mechanism is correct and reversible already — this task
makes it *legible*.

Read [frontend/CLAUDE.md](../../docs/frontend/CLAUDE.md) § *Multi-currency display* and
[ADR-0007](../../docs/adr/0007-reversible-display-currency.md).

## Acceptance criteria

- [ ] The section explains, in Spanish, that converting changes **amounts, balances and the
      payment plan** — everything derived — and that it applies to **every member**, not just the
      person clicking
- [ ] Before converting, the confirmation lists **the rate it will pin for each currency present
      in the group**, with `source` and `asOf` — not just the provider name and date
- [ ] It says plainly that this is **reversible**, and that reverting restores the original
      per-currency view with the original numbers
- [ ] It says that once converted, **the numbers stop moving** — no job, no cache expiry, no
      "this looks stale" heuristic will change them — and that **re-pinning is the only action
      that moves them**. That's a product promise (CLAUDE.md non-negotiable #5) and the UI should
      state it rather than leaving it to be discovered
- [ ] Once converted, the pinned rate for each pair stays visible with its date and source
      (already partly true — extend it to name every pair)
- [ ] The revert control stays **as prominent as the convert control was**
- [ ] Every string goes through i18n keys. No hardcoded user-facing text
- [ ] Reads correctly at 375px — this is a lot of text on a small screen; it must not become a
      wall
- [ ] Tests: the pre-convert confirmation renders a rate line per currency pair, with source and
      date, and still issues no write until confirmed

## Out of scope

Any change to how conversion works, what gets pinned, or when. No new endpoint — if the rate data
needed for the pre-convert preview isn't already reachable, note it and coordinate with
[T104](T104-settle-up-any-currency.md)'s quote rather than adding a second one.

Per-member display currency stays rejected for v1.

## Files likely touched

```
src/app/(app)/g/[groupId]/_components/CurrencySwitcher.tsx
src/app/(app)/g/[groupId]/_components/ConvertCurrencyDialog.tsx
src/lib/i18n/es.ts
```
