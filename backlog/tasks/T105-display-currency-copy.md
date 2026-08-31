---
id: T105
title: Explain what "moneda de visualización" actually changes
epic: E12-first-use
status: done
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

- [x] `CurrencyExplainer` (3 short paragraphs, `es.settings.currency.explain*`): converting
      "recalcula los montos, los balances y el plan de pago —todo lo que el grupo deriva—" and
      "aplica a todos los miembros, no solo a quien lo hace"
- [x] `ConvertRatePreview` (convert mode, before the write) lists one line per present currency →
      target: `USD → COP: <rate> · <source>, <date>`. It reuses **T104's** `GET /fx-quote` (a
      read, writes nothing); a pair with no rate today shows `sin tasa disponible hoy` in
      `--debit` rather than being hidden
- [x] `explainReversible`: "Es reversible: al volver, cada moneda se muestra otra vez con sus
      montos originales."
- [x] `explainFrozen`: "los números dejan de moverse: ningún trabajo automático, caché ni 'esto
      se ve viejo' los cambia. Volver a fijar las tasas es la única acción que lo hace."
- [x] Once converted, `data.pins.map` still renders `pinLine` for every pinned pair with its
      `asOf` + `source` (unchanged — it already covers every pair)
- [x] Revert is `<Button variant="secondary">` now (was `ghost`) — same variant as the convert /
      re-pin buttons; a test asserts `revert.className === repin.className`
- [x] Every new string is an `es.settings.currency.*` key
- [x] Verified at 375px: the explainer is three short paragraphs, not one block; the confirm
      dialog is a full-screen sheet and the rate lines stack
- [x] `CurrencySwitcher.test.tsx`: the pre-convert confirm renders `Tasas que se van a fijar` +
      a `USD → COP: … · source, date` line, `RATE_UNAVAILABLE` shows the unavailable line, and
      no write is recorded until "Convertir" is clicked a second time

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
