# Backend Context

Scope: `src/server/` (db, services, auth, fx) and the Route Handlers in `src/app/api/`.

**Read [splitting.md](../context/splitting.md) before touching expenses, balances, or
settlements.** It specifies the arithmetic to the minor unit. Read
[security.md](../context/security.md) before touching anything that reads group-scoped data.

## Layering

```
src/app/api/**/route.ts   Zod parse → call service → serialize. Nothing else.
src/server/services/      Domain logic. Owns transactions. Framework-agnostic.
src/server/db/            Drizzle schema + migrations. Only services import this.
src/server/auth/          JWT signing/verification, session + membership guards.
src/server/fx/            Rate providers and the refresh job.
src/lib/money/            Pure math. Imports nothing. Services call in; it never calls out.
```

Route handlers stay thin enough to read in one screen. If there's an `if` about domain rules in a
route file, it belongs in a service.

Services take plain arguments and return plain objects — no `Request`, no `NextResponse`. That's
what keeps them testable without booting Next.

## Authorization

**Every service touching group-scoped data takes the acting `userId` and verifies membership
inside the service.** Not in the route handler. Every time, including reads.

```ts
requireMembership(groupId, userId)   // → NotFoundError if not a current member
requireOwner(groupId, userId)        // → ForbiddenError if member but not owner
```

`removed_at IS NOT NULL` is not a member.

**The id-addressed routes are where this gets forgotten.** `GET /api/expenses/:id` and
`PATCH /api/settlements/:id` carry no group id: load the row, read *its* `group_id`, then check.
An unguessable UUID is not an authorization check.

Non-membership is `404`. `403` is reserved for a member lacking `owner`. See
[api-contract.md](../context/api-contract.md).

## Writing an expense

The one transaction that matters:

```
resolve split via src/lib/money/     → concrete (memberId, amount) pairs
assert Σ payers == total == Σ splits → throw before touching the DB
BEGIN
  insert expenses
  insert expense_payers, expense_splits   (with group_id, for the composite membership FK)
  insert expense_revisions (version 1, snapshot)
COMMIT   ← deferred constraint trigger re-validates the sums here
```

Both the assertion and the trigger exist on purpose: the assertion produces an error message that
names the difference, the trigger makes an unbalanced write impossible even from a code path that
skips the service.

**Never trust client-computed amounts.** The client sends a strategy and its inputs; the server
resolves. For `strategy: "exact"` the client does supply numbers — validate they sum to the total
and reject otherwise. Do not adjust them to fit.

`PATCH` replaces the whole expense and bumps `version`, writing a revision in the same
transaction. There is no partial split update.

## Balances

One query returns the group's live ledger rows; everything after that is pure computation in
`src/lib/money/`.

- Filter `deleted_at IS NULL` through the shared `liveExpenses` helper, never by hand.
- **Assert `Σ net == 0` per currency before responding.** If it fails, throw — do not return a
  plausible-looking number. That assertion is the canary for every class of bug in this app.
- No N+1 per member, and **no cached balances table**. A denormalized balance that can disagree
  with the ledger is the exact failure this design avoids. Adding one needs evidence from a real
  group plus an ADR.

## Money

`bigint` minor units + a currency FK. Never `numeric`, never float, never a bare number.

Parse from the wire with an explicit digits-only check — `BigInt("1e9")` throws, but `Number`
coercion elsewhere won't, and a silently truncated amount is unrecoverable.

`numeric` appears only on `fx_rates.rate` and `group_fx_pins.rate`. Read those as **strings** and
shift the digits to a scaled `bigint`. **A `parseFloat` anywhere in the FX path is a bug.**

## FX

Providers sit behind one interface in `src/server/fx/providers/`. Adding or replacing a provider
must not touch conversion math or pinning.

- The daily refresh is an idempotent endpoint triggered by an external timer, not an in-process
  scheduler. Upsert keyed on `(base, quote, as_of, source)`.
- `fx_rates` is **append-only**. Never overwrite a past day — a pinned group references it.
- **Pins never refresh themselves.** No job, no cache expiry, no staleness heuristic may update
  `group_fx_pins`. Only an explicit member re-pin.
- Missing rate → typed `RATE_UNAVAILABLE`, never a silent fall back to a stale one.
- Read [currency.md](../context/currency.md) before touching any of this, especially before
  swapping the provider — the obvious ECB-backed choice does not carry COP.

## Transactions

Wrap every multi-step write. Registration especially: create user + consume invite + insert
membership all commit together, or you get an account with a burned code and no group.

Consume the invite with a conditional update — `WHERE consumed_at IS NULL RETURNING` — and treat
zero rows as `409`. A check-then-insert races two people onto one single-use code.

## Errors

Services throw typed domain errors (`NotFoundError`, `ForbiddenError`, `ConflictError`,
`ValidationError`, `RateLimitError`). One mapper converts them to the wire format in
[api-contract.md](../context/api-contract.md). Don't build response objects inside services.

Domain errors carry structured `details` — `SPLITS_DO_NOT_BALANCE` names `expected`, `actual`, and
`difference` in minor units, because the client renders that difference live and a generic message
would force it to recompute what the server already knows.

## Migrations

Drizzle Kit. `npm run db:generate` after schema edits, review the generated SQL, commit it with
the schema change. Never hand-edit an applied migration.

The deferred constraint trigger and the composite membership FKs are hand-written SQL inside a
generated migration — Drizzle won't produce them. Document them in the migration file so the next
person doesn't "clean up" what looks like stray SQL.

Migrations run at app startup, in production only. Safe because there's exactly one instance;
would race with replicas.

## Rate limiting

Token bucket in the `rate_limits` table. No Redis. Fractional tokens for smooth refill, single
atomic statement for consumption, and a rejected request must not advance the timestamp — or a
client hammering the endpoint resets its own refill clock and never recovers.

Key by IP for unauthenticated routes, user id for authenticated ones. `429` with `Retry-After`.
Fails open on a storage error, with a log.

## Testing

Full strategy: [testing.md](../context/testing.md). Backend specifics:

1. **Authorization on every group-scoped endpoint**, including the id-addressed ones.
2. **The balance trigger**, with the service bypassed — the transaction must abort.
3. **Invite consumption races** — two concurrent registrations, exactly one wins.
4. **Member removal** refused with a non-zero balance, in any currency.
5. **FX** — pins immune to newer rates, no stale fallback, idempotent refresh.

Real Postgres, not a mocked Drizzle. The invariants that matter most are enforced by the database,
and a mock accepts an unbalanced expense without complaint.
