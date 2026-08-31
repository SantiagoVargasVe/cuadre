---
id: T104
title: Settle up in any of the group's currencies, with the conversion spelled out
epic: E12-first-use
status: todo
depends_on: [T103]
size: L
---

## Context

Recording a payment in a mixed-currency group is awkward today. The settle-up form has **no
currency field** — the currency is decided by *which button you pressed*: the one in the Balances
header uses the group's `defaultCurrency`, and each per-edge "Registrar pago" uses that balance
block's currency. So to record a USD payment you have to know to scroll down to the USD block
first. Nothing on screen says so.

And even once you're in the right form, the number you need isn't there. Bank transfers happen in
COP; the debt says `US$ 40`. Nothing tells you what to actually wire.

**The invariant this task has to protect.** A settlement is a plain ledger entry in the currency
it was recorded in — `from → to`, one amount, one currency, one date
([ADR-0009](../../docs/adr/0009-settlements-are-ledger-entries.md)), converted on *read* like
everything else ([ADR-0007](../../docs/adr/0007-reversible-display-currency.md), and
`convertSettlementAmount` in `services/fx.ts`). So:

> **Recording a COP settlement does not reduce a USD debt.** It moves the COP net and leaves the
> USD net exactly where it was.

That makes the obvious-looking design — "let me pay this USD debt in COP" — the wrong one unless
handled deliberately. The steer: **the row records the currency of the debt being settled, and
the helper text tells you how much COP to wire.** The transfer is a real-world fact about a bank;
the ledger entry is a fact about the debt. If the task lands on the other answer instead, that is
a product decision and it must be written down, with the UI making it unmistakable that the USD
balance is still open.

Read [ADR-0009](../../docs/adr/0009-settlements-are-ledger-entries.md),
[ADR-0007](../../docs/adr/0007-reversible-display-currency.md), and
[currency.md](../../docs/context/currency.md) § *Storing rates*.

## Acceptance criteria

- [ ] The settle-up form has a **currency select**, defaulting to the currency of the context it
      was opened from (the plan edge's block, or the group default for the standalone button).
      Reaching a USD payment no longer requires finding the USD block
- [ ] The select offers the currencies **actually present in the group**, not every supported
      code — offering EUR to a COP/USD group is noise
- [ ] The amount field re-formats when the currency changes: COP takes no decimals, USD and EUR
      take two ([splitting.md](../../docs/context/splitting.md) § 1). Switching currency must not
      silently reinterpret a typed amount by a factor of 100
- [ ] **Helper text naming the transfer amount**, whenever the selected currency isn't COP —
      e.g. "Para pagar US$ 40 necesitas transferir $ 168.000". It updates live with the amount
- [ ] **The rate is never a bare number.** Its `source` and `asOf` are shown alongside, per
      currency.md's whole argument (two legitimate sources disagreed by 0.45% on the same day)
- [ ] **No endpoint quotes an arbitrary pair today** — verified against the full route list; the
      only rate-shaped read is `GET /api/groups/:id/display-currency`, and only once a display
      currency is pinned. Add a small read-only quote, or extend an existing response. It must be
      additive and member-only, and it must return the same `{ rate, asOf, source }` shape the
      rest of the app already speaks
- [ ] **Quoting a rate must not write a pin.** Re-pinning is the only thing allowed to move an
      already-converted group's numbers, and only as an explicit member action (CLAUDE.md
      non-negotiable #5). A quote is a read
- [ ] A missing rate surfaces `RATE_UNAVAILABLE` naming the pair and date — **never a silent
      fall back to a stale rate**. The helper text disappears rather than lying
- [ ] The lazy-fetch fallback still applies: a quote for a pair with no rate today may fetch on
      demand, exactly as `ensureRate` already does
- [ ] Amounts entered are still `bigint` minor units at the form boundary; nothing downstream
      sees a `Number`
- [ ] The prefill from a plan edge still works and is still **only a convenience** — nothing
      links the settlement back to the edge, and no code looks for such a link
- [ ] Over- and under-payment remain normal: any positive amount submits
- [ ] Tests: the currency select changes the submitted `currency`; the helper text shows the
      converted transfer amount with its source and date; switching currency re-formats rather
      than reinterpreting the amount; `RATE_UNAVAILABLE` hides the helper instead of showing a
      stale number; a settlement recorded in one currency does not move another currency's net

## Out of scope

Moving actual money — Cuadre records that a payment happened and never touches a payment rail.
Per-member display currency, explicitly rejected for v1
([roadmap.md](../../docs/roadmap.md) § E11). Changing how balances are computed.

## Files likely touched

```
src/app/(app)/g/[groupId]/_components/SettlementForm.tsx
src/app/(app)/g/[groupId]/_components/SettleUpDialog.tsx
src/app/(app)/g/[groupId]/_components/settlementFormSchema.ts
src/app/api/groups/[id]/...            (the rate quote)
src/server/services/fx.ts
src/lib/i18n/es.ts
docs/context/api-contract.md
```
