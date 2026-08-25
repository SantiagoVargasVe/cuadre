---
id: T061
title: Money formatting — <Money> and <MoneyField>
epic: E7-frontend
status: todo
depends_on: [T030, T004]
size: M
---

## Context

The two components every screen in E7 uses. They exist to make sure `Intl` is called in exactly
one place, because its defaults are wrong for this app's primary currency in a way that is easy to
miss and embarrassing to ship.

Read [design-system.md](../../docs/frontend/design-system.md) § *Money display* and
[splitting.md](../../docs/context/splitting.md) § 1.

## Acceptance criteria

- [ ] `src/lib/money/format.ts` is the **only** place `Intl.NumberFormat` is called. Add a lint
      rule if that's cheap
- [ ] **COP formats with `maximumFractionDigits: 0`.** Verified: the default
      `Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' })` renders `$ 150.000,00`,
      because CLDR assigns COP two fraction digits. This surprises everyone once
- [ ] **EUR under `es-CO` renders `EUR 45,00`, not `€45,00`.** Verified. Choose the locale per
      currency or set `currencyDisplay` explicitly
- [ ] `<Money value={Money} signed? />` — `signed` renders `+`/`−` for net positions
- [ ] `font-variant-numeric: tabular-nums` wherever money appears in a column, or a balances list
      becomes unreadable as digits shift. **Verified: Montserrat ships the `tnum` feature**, so
      this works — it would be a silent no-op on a face that lacked it
- [ ] Credit/debit colouring uses `text-credit` / `text-debit`, **never** `text-destructive` —
      the latter fails AA as body text. And colour is never the only signal: `--credit` and
      `--debit` differ in lightness by 0.02 and contrast 1.08:1 against each other, so to a
      deuteranopic user they are the same colour. The sign and the word carry the meaning
- [ ] A converted amount is **always marked**, with the original and the pin date reachable. An
      unlabelled converted number is a trust bug
- [ ] `<MoneyField>`: locale thousands separators while typing (`150.000`), `inputMode="decimal"`,
      and a **`bigint` of minor units out of `onSubmit`**
- [ ] The major→minor conversion happens **once, at the form boundary**. Nothing downstream sees a
      `Number`, and no other component parses money
- [ ] Tests: COP renders without decimals; USD and EUR render with them; EUR under `es-CO` matches
      the documented output; a typed `150.000` submits as `15000000n`; paste, backspace, and
      partial input don't corrupt the value

## Out of scope

The split editor's remainder display (T065).

## Files likely touched

```
src/lib/money/format.ts
src/app/_ui/money.tsx
src/app/_ui/money-field.tsx
src/app/_ui/*.test.tsx
```
