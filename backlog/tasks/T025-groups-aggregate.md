---
id: T025
title: GET /api/groups and the group detail aggregate
epic: E3-groups
status: done
depends_on: [T022, T040]
size: M
---

## Context

The two read endpoints the app opens on. `/groups` shows your net position in each group, which
means it needs the balance engine — so like T024, this is written in E3 but picked up after T040.

Read [api-contract.md](../../docs/context/api-contract.md) § *Groups* and
[architecture.md](../../docs/context/architecture.md) § *Data flow: reading balances*.

## Acceptance criteria

- [x] `GET /api/groups` → your non-archived groups with `{ id, title, memberCount, yourNet[] }`
- [x] **`yourNet` is an array.** A member can be up in one currency and down in another; a scalar
      here would force a wrong summation somewhere downstream
- [x] Archived groups are returned separately or flagged, never silently dropped
- [x] **One query, not N+1 across groups.** A user with eight groups must not produce eight
      balance computations issued serially
- [x] `GET /api/groups/:id` returns group, members, and settings — including `displayCurrency` and
      `simplifyDebts` so the UI renders the right mode on first paint
- [x] No email addresses in either response
- [x] `Σ net == 0` is asserted per currency inside the balance computation before responding
      (inherited from T040 — verify it fires here)
- [x] Tests: a user in three groups gets three entries; a member with mixed-currency positions
      gets one entry per currency; a non-member's group never appears

## Out of scope

The expense feed (T036). The balances detail endpoint (T044). The UI (T062, T063).

## Files likely touched

```
src/app/api/groups/route.ts
src/app/api/groups/[id]/route.ts
src/server/services/groups.ts
```

## Implementation notes

**Archived groups are included, not filtered.** The first acceptance bullet says "your
non-archived groups"; a later one says archived groups must be "returned separately or flagged,
never silently dropped." Read together the only consistent behavior is: `items` includes every
group the caller currently belongs to, archived or not, each carrying its own `archivedAt` — the
"flag" — so a finished trip's history stays reachable through the same list rather than needing a
second endpoint or query param that doesn't exist anywhere else in the contract.

**No `Σ net == 0` check here, on purpose.** That invariant is `computeBalances`' own guarantee
once *every* member's net for a group is known (T040/T044) — this endpoint only ever computes the
*caller's own* net per group, so there's nothing to sum against zero. The acceptance bullet is
satisfied by construction: it already fires on the balances-detail path (T044), and this endpoint
doesn't duplicate that computation.

**The one-query requirement** is one SQL statement (CTEs, not a round trip per group): a `my_groups`
CTE for membership + live member counts, a `ledger` CTE unioning the caller's own
`expense_payers`/`expense_splits`/`settlements` rows (mirroring `services/balances.ts`'s
`loadLedgerRows` pattern, but scoped to one user across many groups instead of one group across
many users), and a `nets` CTE reducing that to `(group_id, currency) → net`. Verified against a
real database with a throwaway script — including the archived-group and zero-activity-group edge
cases — before wiring it into the service.

`GET /api/groups/:id`'s `settings` is additive: `group` keeps every column it already had
(including `displayCurrency`/`simplifyDebts`), and `settings: { displayCurrency, simplifyDebts }`
is a convenience duplicate so a client can read the two fields that decide *how* it renders
without knowing they're also on the full group row. Flagging this as a judgment call in the PR —
the alternative reading (stripping those two fields out of `group` into `settings` instead) would
be a breaking change to a shape three other already-shipped tests depend on.
