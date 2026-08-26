---
id: T044
title: GET /api/groups/:id/balances
epic: E5-balances
status: done
depends_on: [T041, T042, T043]
size: S
---

## Context

The endpoint that assembles everything in E5 into what the UI renders. Thin by design — it wires
together pure functions and asserts the result before returning it.

Read [api-contract.md](../../docs/context/api-contract.md) § *Balances*.

## Acceptance criteria

- [x] `GET /api/groups/:id/balances?simplify=on|off` → the documented shape
- [x] `simplify` **defaults to the group's `simplifyDebts` setting**
- [x] The query parameter is a **preview override that never writes.** Flipping it for the group is
      a `PATCH` on the group. If this handler writes anything, it's wrong
- [x] `byCurrency` has one entry per currency present when there is no display currency, and
      exactly one entry when there is
- [x] Each entry carries `members[]` with `paid/owed/net`, `plan[]`, and `simplified: boolean`
- [x] When `simplified: true`, each plan edge carries `explains[]`
- [x] **`Σ net == 0` per entry, asserted before responding.** Inherited from T040 — verify it fires
      on this path
- [x] Amounts as strings of minor units throughout
- [x] Membership verified inside the service
- [x] Tests: the default follows the group setting; the override doesn't persist; a mixed-currency
      group returns multiple entries and never a combined total; a non-member gets `404`

## Out of scope

Conversion to a display currency (T054 extends this endpoint). The UI (T066).

## Files likely touched

```
src/app/api/groups/[id]/balances/route.ts
src/server/services/balances.ts
```

## Implementation notes

`byCurrency` always returns one entry per currency *actually present in the ledger*, regardless
of the group's `displayCurrency` setting — the "exactly one entry when there is [a display
currency]" half of that acceptance bullet describes the shape *after* T054 adds FX conversion,
which is explicitly out of scope here. `displayCurrency` is still surfaced at the top level
(read straight from the group row) so the client can see the setting; nothing yet collapses
`byCurrency` around it.

`plan` is contextual on `simplified`: the raw pairwise debts (T041) when `false`, `simplify()`'s
edges decorated with `explains[]` (T042) when `true`. `explains` is an omitted key (not `[]`) on
every edge when `simplified: false` — matches the documented shape's "may also carry" wording,
and lets a client branch on `"explains" in edge` rather than checking `simplified` twice.

Needed a second raw-data query beyond T040's existing `loadLedgerRows`: that query is
member-flattened (fine for net, which only needs per-member sums), but T041's pairwise
attribution needs to know which payer/split amounts belong to the *same expense*. Added
`loadPairwiseLedger`, grouping live `expense_payers`/`expense_splits` by `expense_id` in two
joined queries (never one per expense), plus a third for settlements (already flat).
