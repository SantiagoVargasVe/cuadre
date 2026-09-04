# Data Model

PostgreSQL 17, Drizzle ORM. Money columns are `bigint` minor units — read
[splitting.md](splitting.md) §1 before you write a single column.

Several invariants here are enforced by the **database**, not by application code, and
deliberately so. This is shared-money data: an unbalanced expense that only application code
guards against will eventually be written by a code path nobody thought about.

## Tables

### `currencies`

Reference data, seeded by migration. Exists so the minor-unit exponent has one authoritative
home and so every money-bearing column can carry a real foreign key.

`code char(3) pk` · `exponent smallint` · `display_decimals smallint` · `name`

`COP` is seeded as `exponent 2, display_decimals 0` — see [currency.md](currency.md) for why
those differ.

### `expense_categories`

Reference data, seeded by migration `0009` (T090). The same lookup-table shape as `currencies`,
deliberately **not** a `pgEnum` — a seventh category is an `INSERT`, not an enum `ALTER`.

`key text pk` · `sort_order smallint`

Seeded with exactly `comida, alojamiento, transporte, mercado, actividades, otro`. **No label
column** — the Spanish labels live in `src/lib/i18n/es.ts` under `categories.*`, so a locale change
never touches stored data or an exported file. `sort_order` is the display order and mirrors
`EXPENSE_CATEGORY_KEYS` in `src/lib/categories.ts`.

### `users`

`id uuid pk` · `email citext unique` · `display_name` · `password_hash` ·
`avatar_variant` nullable · `avatar_seed` nullable · `avatar_palette` nullable ·
`email_verified_at timestamptz` nullable · `sessions_valid_from timestamptz not null` · timestamps

Argon2id hashes. No role column — see the sibling repo's precedent; authorization here is
membership-based, not role-based, with the single exception of `group_members.role`.

The three `avatar_*` columns hold a member's chosen generated avatar (T108) — a
`boring-avatars` variant, an **app-generated** seed (`nanoid`, never free text), and a
**named** palette from a curated set (`avatar_palette` stores the name, never raw hex).
All three nullable: `null` means the T107 default (variant `beam`, seeded by the user id,
default palette), so existing rows need no backfill and the columns drop cleanly. Values are
validated at the API boundary; the columns are plain `text` to keep the migration reversible.

`email_verified_at` (E15, migration `0011`) is null until the address is verified; the timestamp
answers *when*, which a boolean can't, and it's an audit trail. **Not backfilled** — marking a
possibly-mistyped address as verified is the state [ADR-0013](../adr/0013-email-verification-gates-recovery.md)
exists to prevent, and T118's `legacy_backfill` doesn't transfer because "this inbox is
controlled" isn't a decision anyone can make for someone else. Only `GET /api/auth/me` ever
exposes it, for the caller's own account — verification status is not the group's business.

`sessions_valid_from` (E15, migration `0011`) is the account's session epoch: T123 resolves a JWT
only when its `iat >= sessions_valid_from`, so moving it forward (on a password reset or change)
revokes every session minted earlier — the per-session revocation
[ADR-0003](../adr/0003-jwt-cookie-and-bearer.md) deferred. It is **not null** so no read site has
to decide what null means, and every write truncates to a whole second (`date_trunc('second',
now())`, and `+ interval '1 second'` on a bump) because a JWT `iat` is whole seconds and the
check must stay a plain comparison. Migration `0011`'s column default doubles as the one-time
backfill for existing rows — set to the migration instant, deliberately not epoch (inert) and not
a future value (which would bar re-login); pre-E15 sessions are re-established on next sign-in.
Spent/expired `auth_tokens` are never swept — one row per request is a rounding error at this
scale (ADR-0012 § *Consequences*).

### `legal_acceptances`

`user_id → users` · `document` (`terms | privacy`) · `document_version` ·
`acknowledged_at timestamptz` · `source` (`registration | legacy_backfill`) — composite pk
`(user_id, document, document_version)`

One immutable row is evidence that a user acknowledged one exact document version. New document
versions are new rows; nothing updates or deletes old evidence, and migration `0010` enforces that
with a trigger. There is deliberately no current-state consent boolean on `users`.

Registration inserts the current Terms and Privacy rows in the same transaction as the user,
invite consumption, and optional group membership. The server owns the versions, source, and
timestamp. Migration `0010` backfills both initial `2026-09-03` versions for accounts that already
exist at rollout time, using that rollout timestamp and `legacy_backfill` so the deliberate product
assumption is distinguishable from an explicit registration action.

### `auth_tokens`

`token_hash text pk` · `user_id → users` (`ON DELETE CASCADE`) · `purpose`
(`password_reset | email_verify`) · `expires_at timestamptz` · `used_at timestamptz` nullable ·
`created_at` — index on `(user_id, purpose)`

One table for both single-use secrets in the account-recovery epic (E15), because they are the
same object and share the atomic-consume statement that is the easiest thing here to get wrong
([ADR-0013](../adr/0013-email-verification-gates-recovery.md) § *Why one token table*).
`purpose` is a `pgEnum` (like `legal_document`), and it belongs in the consume statement's
`WHERE`, never a check afterwards — a verification token honoured by the reset path would let
anyone who can read a verification mail set a password.

**Only the SHA-256 of a token is stored**, and lookup is by that hash. Deliberately not Argon2id:
a 32-byte CSPRNG token isn't guessable at any per-attempt cost, so a memory-hard hash would add
~100 ms and ~19 MB per lookup for nothing — but hashing at all still keeps a leaked backup or a
stray `SELECT *` in a log from handing over live links ([ADR-0012](../adr/0012-password-reset-via-single-use-token.md)
§ *Why SHA-256*). Expiries: 30 minutes for `password_reset`, 24 hours for `email_verify`. Rows are
never swept; `ON DELETE CASCADE` and delete-on-consume (T122) bound the accumulation.

### `invite_codes`

`code` (pk, nanoid) · `created_by → users` · `group_id → groups` **nullable** · `expires_at`
nullable · `consumed_by → users` nullable · `consumed_at` nullable · `created_at`

**One table serves both purposes.** A code with `group_id = null` is a plain registration invite.
A code with a `group_id` is a group invite that *also* works as a registration invite — the
recipient registers through it and lands in the group in one transaction. That unification is the
whole onboarding flow ([ADR-0002](../adr/0002-invite-only-registration.md)).

Consumed atomically with the user insert. A partially consumed code is a bug, not a state.

### `groups`

`id uuid pk` · `title` · `description` · `default_currency → currencies` ·
`display_currency → currencies` **nullable** · `simplify_debts boolean default false` ·
`created_by → users` · `archived_at` nullable · timestamps

- `display_currency = null` means "show every expense in the currency it was entered in".
- `simplify_debts` is a **display preference**. It is the only thing simplification writes
  anywhere ([ADR-0006](../adr/0006-simplification-is-derived.md)).

### `group_members`

`group_id → groups` · `user_id → users` · `role` (`owner | member`) · `joined_at` ·
`removed_at` nullable — **composite pk `(group_id, user_id)`**

- **Add a `UNIQUE (group_id, user_id)` explicitly** even though it's the pk, because child tables
  reference it as a composite foreign key (below).
- Members are **never hard-deleted**. `removed_at` retires them; the row must survive because
  historical expenses reference it. Removing a member with a non-zero balance is refused.
- `role` exists only to decide who can rename/archive the group and manage members. Everything
  else any member can do.

### `expenses`

`id uuid pk` · `group_id → groups` · `title` · `expense_date date` ·
`total_amount bigint` · `currency → currencies` · `split_strategy` ·
`category_key → expense_categories` **nullable** ·
`created_by → users` · `updated_by → users` · `version integer default 1` ·
`deleted_at` nullable · timestamps

- `expense_date` is a **calendar `date`** — no time, no zone. "The dinner on the 14th" is not an
  instant, and a trip crossing timezones must not shift an expense onto another day.
- `split_strategy` ∈ `equal | equal_subset | shares | percentage | exact | loan`. Kept so the
  edit form can reopen in the mode it was created in. **It is not read by the balance engine** —
  the resolved amounts in `expense_splits` are the truth.
- `category_key` is **nullable on purpose** (T090): `null` means "nobody categorised this",
  which is honestly what every expense predating T090 is — distinct from an explicit `otro`. No
  backfill. An unknown key is rejected by the FK, and earlier by Zod at the route boundary
  (`400 VALIDATION_ERROR`). It is carried in each `expense_revisions` snapshot.
- `CHECK (total_amount > 0)`.
- **There is no `paid_by` column.** [ADR-0005](../adr/0005-expense-as-balanced-ledger-entry.md).
- Index on `(group_id, expense_date DESC) WHERE deleted_at IS NULL` — the group feed's only query.

### `expense_payers`

`expense_id → expenses` · `group_id` · `user_id` · `amount bigint` — pk `(expense_id, user_id)`

### `expense_splits`

`expense_id → expenses` · `group_id` · `user_id` · `amount bigint` · `weight bigint` nullable —
pk `(expense_id, user_id)`

Both child tables:

- `CHECK (amount > 0)`
- carry a **denormalized `group_id`** for one reason: it enables
  `FOREIGN KEY (group_id, user_id) REFERENCES group_members (group_id, user_id)`. That makes
  "you cannot put a non-member on an expense" a database guarantee rather than a service check
  everyone has to remember. Keep it in sync with the parent inside the same transaction.
- `weight` on splits stores the raw input (shares, or basis points for `percentage`) so an edit
  can round-trip. `amount` is always the resolved minor-unit value.

### The balanced-expense constraint

```
sum(expense_payers.amount) == expenses.total_amount == sum(expense_splits.amount)
```

This spans three tables, so it cannot be a `CHECK`. Implement it as a
**`CONSTRAINT TRIGGER ... DEFERRABLE INITIALLY DEFERRED`** that re-validates the expense at
**commit time** — the rows have to be insertable in any order within the transaction, and an
immediate trigger would fire before the last one lands.

The application asserts the same thing before writing ([splitting.md](splitting.md) §2). Both
exist on purpose: the assertion produces a good error message, the trigger makes it impossible.

### `settlements`

`id uuid pk` · `group_id → groups` · `from_user_id` · `to_user_id` · `amount bigint` ·
`currency → currencies` · `settled_on date` · `note` nullable · `created_by` ·
`deleted_at` nullable · timestamps

- `CHECK (from_user_id <> to_user_id)`, `CHECK (amount > 0)`
- Composite FKs to `group_members` for both participants, same as expense children
- Not linked to an expense or to a plan edge — see
  [ADR-0009](../adr/0009-settlements-are-ledger-entries.md)

### `expense_revisions`

`id uuid pk` · `expense_id` · `version integer` · `action` (`created | updated | deleted`) ·
`snapshot jsonb` · `changed_by → users` · `changed_at` — unique `(expense_id, version)`

A full snapshot of the expense and its payer/split rows at each change. Shared-money history is
the product: "this said I owed 40.000 yesterday" has to be answerable. Written in the same
transaction as the change, never after.

MVP writes revisions and exposes "edited" + who + when. The full diff viewer is E9.

### `fx_rates`

`base_currency` · `quote_currency` · `rate numeric(20,10)` · `as_of date` · `source` ·
`fetched_at` — unique `(base_currency, quote_currency, as_of, source)`

Append-only. Never overwrite a past day's rate — pinned groups reference it.
See [currency.md](currency.md).

### `group_fx_pins`

`group_id → groups` · `from_currency` · `to_currency` · `rate numeric(20,10)` · `as_of date` ·
`source` · `pinned_at` · `pinned_by → users` — pk `(group_id, from_currency, to_currency)`

The rates a group converted at. **Nothing may update these except an explicit re-pin by a
member.** Not a cron job, not a cache refresh, not a "the rate looks stale" heuristic.

Kept when `display_currency` is cleared, so toggling back reproduces the same numbers.

### `rate_limits`

`key text pk` · `tokens numeric` · `updated_at`

Token bucket in Postgres — no Redis; the volume doesn't justify a container. Fractional tokens
for smooth refill, single-statement atomic consumption, and a rejected request must not advance
the timestamp. Same design as the sibling wishlist app's limiter.

## Money

Every money column is `bigint` minor units paired with a `currency` FK. Never `numeric`, never
`float`, never a bare number without its currency next to it.

`numeric` appears in exactly two places — `fx_rates.rate` and `group_fx_pins.rate` — because
those are rates, not money. Both are read as strings and parsed to scaled integers.

Full rules: [splitting.md](splitting.md) §1.

## Deletion semantics

| Thing | What happens |
|---|---|
| Expense | Soft delete (`deleted_at`) + a `deleted` revision. Excluded from every balance query via a `liveExpenses` helper. |
| Settlement | Soft delete, same reasoning. |
| Group member | `removed_at`. **Refused while their net balance ≠ 0** in any currency. Their historical rows stay valid. |
| Group | `archived_at`. Read-only afterwards; nothing cascades. |
| User | Not supported in v1. It would orphan ledger rows in other people's groups, which is a real design question and not an MVP one. |
| Legal acceptance | Immutable. A newer document version adds a row; it never rewrites or deletes the version previously acknowledged. |

Nothing in this schema hard-deletes anything a balance was ever computed from. Restated: the data
here is **not reconstructable** — unlike a wishlist item, a trip's ledger cannot be re-derived
from any external source.

## Query rules

- **Always** filter `deleted_at IS NULL` on expenses and settlements — via the shared helper, not
  by hand at each call site.
- Balances are **one** query per group returning the raw ledger rows, then pure computation.
  Never N+1 per member, and never a stored aggregate ([architecture.md](architecture.md)).
- `Σ net == 0` is asserted after every balance computation. If it fails, fail the request loudly.
