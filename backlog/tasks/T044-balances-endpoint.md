---
id: T044
title: GET /api/groups/:id/balances
epic: E5-balances
status: todo
depends_on: [T041, T042, T043]
size: S
---

## Context

The endpoint that assembles everything in E5 into what the UI renders. Thin by design — it wires
together pure functions and asserts the result before returning it.

Read [api-contract.md](../../docs/context/api-contract.md) § *Balances*.

## Acceptance criteria

- [ ] `GET /api/groups/:id/balances?simplify=on|off` → the documented shape
- [ ] `simplify` **defaults to the group's `simplifyDebts` setting**
- [ ] The query parameter is a **preview override that never writes.** Flipping it for the group is
      a `PATCH` on the group. If this handler writes anything, it's wrong
- [ ] `byCurrency` has one entry per currency present when there is no display currency, and
      exactly one entry when there is
- [ ] Each entry carries `members[]` with `paid/owed/net`, `plan[]`, and `simplified: boolean`
- [ ] When `simplified: true`, each plan edge carries `explains[]`
- [ ] **`Σ net == 0` per entry, asserted before responding.** Inherited from T040 — verify it fires
      on this path
- [ ] Amounts as strings of minor units throughout
- [ ] Membership verified inside the service
- [ ] Tests: the default follows the group setting; the override doesn't persist; a mixed-currency
      group returns multiple entries and never a combined total; a non-member gets `404`

## Out of scope

Conversion to a display currency (T054 extends this endpoint). The UI (T066).

## Files likely touched

```
src/app/api/groups/[id]/balances/route.ts
src/server/services/balances.ts
```
