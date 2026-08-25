---
id: T053
title: Display currency and pinned rates
epic: E6-currency
status: todo
depends_on: [T052, T022]
size: M
---

## Context

The "convert everything to one currency" action — implemented as a reversible display setting plus
a rate snapshot, so it never rewrites an expense. This is the decision that keeps the one
irreversible-looking action in the product from actually being irreversible.

Read [ADR-0007](../../docs/adr/0007-reversible-display-currency.md) in full and
[currency.md](../../docs/context/currency.md) § *Display currency*.

## Acceptance criteria

- [ ] `group_fx_pins`: pk `(group_id, from_currency, to_currency)`, `rate numeric(20,10)`,
      `as_of`, `source`, `pinned_at`, `pinned_by`
- [ ] `PUT /api/groups/:id/display-currency { currency }` → sets `groups.display_currency` and
      writes **one pin per currency present in the group**, in one transaction
- [ ] Pins store the **derived cross rates** directly, so read-time conversion is one
      multiplication and never re-derives. Changing `FX_BASE_CURRENCY` later must not move an
      already-pinned group
- [ ] **No expense row is written, updated, or read-modified.** If this handler touches `expenses`,
      it contradicts the ADR
- [ ] The response returns the pins — rate, `asOf`, `source` — because the UI has to show what it
      converted at
- [ ] `DELETE` clears `display_currency` and **keeps the pin rows**, so re-enabling reproduces the
      same numbers and the group keeps a record of what it converted at and when
- [ ] Re-`PUT`ting the same currency **re-pins at today's rates**. That is the only thing that
      moves an already-converted group's numbers, and it is always an explicit member action
- [ ] **Nothing else may ever update a pin** — no job, no cache expiry, no staleness heuristic.
      Write that as a comment at the table definition and at the service
- [ ] A rate older than 7 days is refused for a **new** pin (`RATE_TOO_STALE`). Already-pinned
      groups are unaffected
- [ ] `RATE_UNAVAILABLE` when a needed pair can't be resolved even after the lazy fetch
- [ ] Tests: pinning writes one row per present currency; **inserting newer `fx_rates` rows does
      not change an existing pin's output** — the central test of this task; `DELETE` then `PUT`
      the same currency reproduces the original numbers from the retained pins; a stale rate is
      refused for a new pin but not for an existing one

## Out of scope

Applying pins on the read path (T054). The currency switcher UI (T068).

## Files likely touched

```
src/server/db/schema.ts
src/server/db/migrations/
src/app/api/groups/[id]/display-currency/route.ts
src/server/services/fx.ts
```
