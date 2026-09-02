# API Contract

JSON over `/api`. Route Handlers stay thin: Zod parse → service → serialize.

## Conventions

**Money** crosses the wire as a string of minor units plus its code. Never a number.

```json
{ "amount": "15000000", "currency": "COP" }
```

**Dates** on expenses and settlements are calendar dates, `YYYY-MM-DD`. Timestamps elsewhere are
RFC 3339 UTC.

**Errors** are always this shape:

```json
{ "error": { "code": "SPLITS_DO_NOT_BALANCE", "message": "…", "details": { … } } }
```

**Status codes**

| Code | When |
|---|---|
| `400` | Malformed request — failed Zod parsing |
| `401` | No session, or an invalid/expired token |
| `403` | You're a member, but this action needs `owner` |
| `404` | Doesn't exist — **or you're not a member of the group it's in** |
| `409` | Conflict: invite already consumed, member already in group |
| `422` | Well-formed but domain-invalid: splits don't balance, percentages ≠ 100%, removing a member who still owes |
| `429` | Rate limited, with `Retry-After` |

> **Non-membership is `404`, not `403`** — this differs from the sibling wishlist repo on purpose.
> Groups are private and their ids are unguessable UUIDs, so there is no reason to confirm that a
> given group exists to someone outside it. `403` is reserved for the *inside* case: a member who
> lacks `owner`. Don't collapse the two.

**Auth** accepts either the `cuadre_session` httpOnly cookie (web) or
`Authorization: Bearer <jwt>` (future native clients). Same token, same claims, same expiry —
see [ADR-0003](../adr/0003-jwt-cookie-and-bearer.md).

**Pagination** is cursor-based on list endpoints: `?cursor=&limit=` (default 50, max 200),
responding `{ items, nextCursor }`.

---

## Auth

```
POST /api/auth/register    { email, displayName, password, inviteCode }  → 201 { user }
POST /api/auth/login       { email, password }                          → 200 { user }
POST /api/auth/logout                                                   → 204
GET  /api/auth/me                                                       → 200 { user, groups[] }
PUT  /api/auth/avatar      { variant, seed, palette } | null            → 200 { avatar }
PATCH /api/auth/profile    { displayName }                             → 200 { user }
```

`register` consumes the invite code in the same transaction that creates the user — and, if the
code carries a `groupId`, adds the membership too. All three commit together or none do.

`user` on `register` / `login` / `me` carries `avatar` — the member's chosen generated avatar
(`{ variant, seed, palette }`) or `null` for the T107 default.

`PUT /api/auth/avatar` sets **the session user's own** avatar (T108) — the acting user comes
from the session, never the body. `variant` is one of the six `boring-avatars` names, `seed`
must match the app-generated shape (`[A-Za-z0-9_-]{6,24}` — never free text), `palette` is a
name from the curated set. `null` resets to the default. It responds with just `{ avatar }` —
**this flow never returns an email**. Malformed input is `400`.

`PATCH /api/auth/profile` changes **the session user's own** display name (T109) — same source
of truth for the acting user, and a `userId` in the body is stripped by the schema rather than
honoured. `displayName` is validated against exactly registration's bounds (1–200 characters);
anything else is `400`. It responds with `{ user: { id, displayName, avatar } }` — **no email**.
Nothing denormalizes a display name, so one write updates every member list, payer/split row and
settlement line that shows it.

Every read that returns a member's `display_name` also returns their `avatar` — `GET
/api/groups/:id` (`members[]`) and `GET /api/groups/:id/members`. Still never an email.

Login and register are rate limited by IP. Argon2 verification is deliberately expensive, so an
unthrottled login endpoint is a cheap way to saturate the box.

---

## Groups

```
GET    /api/groups                    → 200 { items: [{ id, title, memberCount, yourNet[] }] }
POST   /api/groups                    { title, description?, defaultCurrency? } → 201 { group }
GET    /api/groups/:id                → 200 { group, members[], settings }
PATCH  /api/groups/:id                { title?, description?, simplifyDebts? }  → 200 { group }
POST   /api/groups/:id/archive        → 200 { group }        (owner only)
```

`yourNet` on the list is an array — a member can be up in one currency and down in another.

### Members and invites

```
GET    /api/groups/:id/members                → 200 { members[] }
POST   /api/groups/:id/invites                { expiresAt? } → 201 { code, url }
DELETE /api/groups/:id/members/:userId        → 204          (owner only)
POST   /api/invites/:code/accept              → 200 { group } (already-registered user)
GET    /api/invites/:code                     → 200 { groupTitle?, inviterName, valid }
```

`GET /api/invites/:code` is **unauthenticated** — the register page needs to show "Ana invited you
to *Cartagena 2026*" before anyone has an account. It returns the group title and inviter's
display name and **nothing else**: no member list, no expense count, no ids.

`DELETE …/members/:userId` returns `422` with the outstanding balances if that member's net is
non-zero in any currency. You cannot walk out mid-trip.

---

## Expenses

```
GET    /api/groups/:id/expenses          ?cursor=&limit=  → 200 { items[], nextCursor }
POST   /api/groups/:id/expenses                           → 201 { expense }
GET    /api/groups/:id/expenses.csv                       → 200 text/csv
GET    /api/expenses/:id                                  → 200 { expense }
PATCH  /api/expenses/:id                                  → 200 { expense }
DELETE /api/expenses/:id                                  → 204
GET    /api/expenses/:id/revisions                        → 200 { revisions[] }
```

### Creating an expense

The minimal, overwhelmingly common case — you paid, split equally among everyone:

```json
{
  "title": "Cena en Cartagena",
  "date": "2026-08-24",
  "amount": "30000000",
  "currency": "COP",
  "paidBy": [{ "userId": "…ana", "amount": "30000000" }],
  "split": { "strategy": "equal" }
}
```

The client may omit `paidBy` entirely, in which case it defaults to the authenticated user paying
the full amount. `split.strategy: "equal"` with no member list means every current member.

The flexible cases, all in the same `split` object:

```json
{ "strategy": "equal_subset", "members": ["…ana", "…beto", "…caro"] }
{ "strategy": "shares",       "weights": { "…ana": 2, "…beto": 1 } }
{ "strategy": "percentage",   "basisPoints": { "…ana": 6000, "…beto": 4000 } }
{ "strategy": "exact",        "amounts": { "…ana": 4200, "…beto": 5800 } }
{ "strategy": "loan",         "to": "…beto" }
```

Multiple payers is just a longer `paidBy` array.

**Percentages are basis points, integers, summing to exactly `10000`.** Not floats, and not
"about 100". `60%` is `6000`.

**`category`** is optional (T090): one of the fixed keys
`comida | alojamiento | transporte | mercado | actividades | otro`, or omitted / `null` for an
uncategorised expense. It is **not** a free-form tag. An unknown key is a `400 VALIDATION_ERROR`
at the route boundary — never a silent `null`. A `PATCH` sends `null` (or omits it) to clear a
category that was set.

The response echoes the **resolved** per-member amounts, so the client never re-derives them and
can never disagree with the server about who owes what:

```json
{
  "id": "…", "total": { "amount": "30000000", "currency": "COP" },
  "payers": [ { "userId": "…ana", "amount": "30000000" } ],
  "splits": [
    { "userId": "…ana",  "amount": "10000000" },
    { "userId": "…beto", "amount": "10000000" },
    { "userId": "…caro", "amount": "10000000" }
  ],
  "strategy": "equal", "category": null, "version": 1, "editedAt": null
}
```

**Errors specific to this endpoint**

| Code | Meaning |
|---|---|
| `SPLITS_DO_NOT_BALANCE` | `422`. `details` carries `expected`, `actual`, and `difference` in minor units. |
| `PAYERS_DO_NOT_BALANCE` | `422`. Same shape. |
| `PERCENTAGES_DO_NOT_SUM` | `422`. `details.sum` in basis points. |
| `NOT_A_MEMBER` | `422`. A payer or split member isn't in the group. `details.userIds`. |
| `CURRENCY_NOT_SUPPORTED` | `422`. |

### Editing

`PATCH` replaces the whole expense — payers and splits included — and bumps `version`, writing an
`expense_revisions` row in the same transaction. There is no partial split patch; resolving a
half-updated split against a stale total is not a thing anyone should have to reason about.

Any member may edit or delete any expense in their group. `updated_by` and the revision history
are what make that safe, not permissions.

### Reading a list or a single expense

`GET .../expenses` (`items[]`) and `GET /api/expenses/:id` (`expense`) share one shape —
`payers`/`splits` carry `displayName` alongside each `userId`, since the feed renders "who paid"
without a second round trip:

```json
{
  "id": "…", "title": "Cena en Cartagena", "date": "2026-08-24",
  "total": { "amount": "30000000", "currency": "COP" },
  "payers": [ { "userId": "…ana", "amount": "30000000", "displayName": "Ana" } ],
  "splits": [
    { "userId": "…ana",  "amount": "10000000", "displayName": "Ana" },
    { "userId": "…beto", "amount": "10000000", "displayName": "Beto" },
    { "userId": "…caro", "amount": "10000000", "displayName": "Caro" }
  ],
  "strategy": "equal",
  "category": null,
  "editedAt": null, "editedBy": null,
  "converted": null
}
```

`category` is the fixed-set **key** (T090), or `null` when uncategorised — never a localised
label; the client maps it through i18n. Present on every row, list and detail alike.

`editedAt`/`editedBy` are `null` for a never-edited expense (`version === 1`); otherwise `editedAt`
is the last edit's timestamp and `editedBy` is `{ userId, displayName }` — on **every** row, not
just the single-expense detail, so the feed can show its own "editado" marker without a second
fetch per row. `editedBy` can still be `null` on an edited expense if the editor's account no
longer exists (`updated_by`'s FK is `ON DELETE SET NULL`) — "when" and "who" are independent.

The single-expense detail (`GET /api/expenses/:id`) additionally carries `version` and `split`.
`split` is the original strategy input reconstructed from the stored rows (including raw shares
or basis points), so an edit form can round-trip the expense without changing its meaning. It is
detail-only: the feed does not carry editor state for every row.

### Revision history

`GET /api/expenses/:id/revisions` returns revisions newest first. It is an id-addressed read:
the service loads the expense, checks the acting user is a current member of *that row's* group,
and returns `404` for a non-member, removed member, soft-deleted expense, or unknown id.

Each revision carries `version`, `action` (`created`, `updated`, or `deleted`), `changedAt`, and
`changedBy` (`{ userId, displayName }` or `null`). `changedBy` may be null when an account no
longer exists; its timestamp remains intact. `created` and `deleted` revisions have `changes: []`.
For `updated`, `changes[]` is a server-computed diff against the preceding snapshot: scalar title,
expense date, total, currency, and split strategy changes plus payer/split member additions,
removals, and amount changes. Money values use the standard wire shape (`{ amount, currency }`),
with each side retaining its own currency. Snapshots themselves — and therefore email addresses —
are never returned.

### Reading, with a display currency set

`GET .../expenses` and `GET /api/expenses/:id` add a `converted` field next to `total`/`payers`/
`splits`, so the UI can show both the original amounts and what they come to in the group's
display currency:

```json
{ "total": { "amount": "30000000", "currency": "COP" }, "payers": [ … ], "splits": [ … ],
  "converted": {
    "total": { "amount": "75", "currency": "USD" },
    "payers": [ { "userId": "…ana", "amount": "75", "displayName": "Ana" } ],
    "splits": [ … ]
  } }
```

`converted` is `null` when there's no display currency, or the expense is already in it — nothing
to add to what `total`/`payers`/`splits` already show. `RATE_UNAVAILABLE` (`422`) for the same
reason as the balances endpoint: a currency present with no matching pin.

### CSV export

`GET /api/groups/:id/expenses.csv` is the one endpoint that doesn't return JSON.

```
200 Content-Type:        text/csv; charset=utf-8
    Content-Disposition: attachment; filename="cartagena-2026-gastos-2026-09-01.csv"
```

Available to **every member** — the escape hatch is not an owner privilege. Membership is checked
inside the service, so a non-member and a removed member both get `404`, never a `403` and never
an empty file.

**Un-paginated on purpose.** It returns the complete live ledger and does not reuse the paginated
expense feed. A query string has no effect on the export.

There is **one row per expense**, ordered `expense_date ASC, id ASC`. Columns, in order:

```
expense_id,date,title,amount_minor,currency,split_strategy,category,payers,splits,created_at,updated_at
```

- `amount_minor` and every nested `amount` are digits-only minor-unit strings, never floats or
  locale-formatted money. Each row retains its entered `currency`; no display-currency conversion
  or cross-currency aggregate is calculated.
- `category` is the fixed-set **key** (`comida | alojamiento | transporte | mercado | actividades
  | otro`), never the localised label, so the file is stable across a locale change. Empty when
  the expense is uncategorised.
- `payers` and `splits` are JSON arrays in one CSV cell. Each object preserves `userId`,
  `displayName`, and `amount`, so multiple payers and non-equal splits remain auditable.
- Soft-deleted expenses are absent. A group with no expenses still gets its header row.
- RFC 4180 quoting protects commas, quotes, CR/LF, and Unicode. Plain user-controlled cells whose
  first non-whitespace character is `=`, `+`, `-`, or `@` receive a leading apostrophe so they do
  not execute as spreadsheet formulas. JSON cells retain their original nested values and begin
  with `[`.

---

## Balances

```
GET /api/groups/:id/balances    ?simplify=on|off    → 200 { … }
```

`simplify` defaults to the group's `simplifyDebts` setting. The query parameter is an **override
for preview only** — it never writes. Flipping the toggle for real is
`PATCH /api/groups/:id { simplifyDebts }`.

```json
{
  "displayCurrency": null,
  "byCurrency": [
    {
      "currency": "COP",
      "members": [
        { "userId": "…ana",  "paid": "30000000", "owed": "10000000", "net": "20000000"  },
        { "userId": "…beto", "paid": "0",        "owed": "10000000", "net": "-10000000" },
        { "userId": "…caro", "paid": "0",        "owed": "10000000", "net": "-10000000" }
      ],
      "plan": [
        { "from": "…beto", "to": "…ana", "amount": "10000000" },
        { "from": "…caro", "to": "…ana", "amount": "10000000" }
      ],
      "simplified": false
    }
  ]
}
```

- `byCurrency` has **one entry per currency present** when the group has no display currency, and
  exactly one entry when it does. The client must not sum across entries.
- `Σ net` inside each entry is always `0`. The server asserts it before responding.
- When `simplified: true`, each plan edge may also carry `explains[]` — the raw pairwise debts it
  replaced — so the UI can answer "why am I paying someone I never bought anything with".
- When the group has a display currency, the single entry also carries `pins` — the same
  `{ fromCurrency, toCurrency, rate, asOf, source }` rows `PUT /display-currency` returns — so the
  UI can label what it converted at. Absent when there's no display currency.
- `RATE_UNAVAILABLE` (`422`) if a currency present in the group's activity has no matching pin —
  e.g. a member added an expense in a currency after the group last pinned. Never shown unconverted.

---

## Insights

```
GET /api/groups/:id/insights    → 200 { displayCurrency, byCurrency[] }
```

Server-computed spending aggregates, the per-member breakdown, and a one-glance summary for the
Análisis tab (T081, T082, T084). The client renders and **never re-aggregates money** — same rule
as balances. Takes no query parameters; the buckets come from the group's own expense dates.
Membership is checked in the service, so a non-member and a removed member both get `404`.

```json
{
  "displayCurrency": null,
  "byCurrency": [
    {
      "currency": "COP",
      "summary": {
        "totalSpent": "120000", "expenseCount": 3,
        "firstExpenseDate": "2026-08-20", "lastExpenseDate": "2026-09-01",
        "averagePerExpense": "40000",
        "largestExpense": { "title": "Hotel", "amount": "80000", "currency": "COP",
                            "payers": ["Ana", "Beto"] },
        "carrying": { "userId": "…ana", "amount": "34000" }
      },
      "byDay":   [ { "key": "2026-08-24", "amount": "40000" } ],
      "byMonth":  [ { "key": "2026-08", "amount": "40000" } ],
      "byCategory": [ { "category": "comida", "amount": "30000" },
                      { "category": null, "amount": "10000" } ],
      "members": [
        { "userId": "…ana", "paid": "40000", "consumed": "25000",
          "expenseContribution": "15000", "sent": "0", "received": "0", "currentNet": "15000" }
      ]
    }
  ]
}
```

- `summary` (T084) considers **live expenses only** — settlements are not spending.
  `averagePerExpense` is `totalSpent / expenseCount` floored to a minor unit (`"0"` with no
  expenses). `largestExpense` breaks a total tie by the earliest `expense_date`, then the lowest
  expense id, and lists payer **display names**; it is `null` for a currency with no expenses.
  `carrying` is the member with the largest **positive `currentNet`** (settlement-aware, so it
  agrees with balances), tie broken by lowest user id, and **`null` when nobody is up** — an
  all-settled group. When a display currency is pinned, every figure (largest expense included)
  is computed from the converted, re-apportioned amounts.
- **One block per currency, never summed.** `byDay`/`byMonth` are period buckets over
  `expense_date`; `byCategory` totals by T090's keys with **`null` kept as its own bucket** —
  never folded into `otro`. Every amount is a minor-unit string in `currency`; only buckets with
  a positive total are returned. `byCategory` is biggest-first (ties broken by key); the periods
  are chronological.
- `members` (T082) is one row per member: **`paid`** (Σ payer rows), **`consumed`** (Σ split
  rows), **`expenseContribution` = paid − consumed** (what the paired bars show), **`sent`** /
  **`received`** (settlement rows), and **`currentNet` = expenseContribution + sent − received**,
  which equals the balances endpoint's `net` exactly and is asserted `Σ currentNet == 0` per
  currency. `expenseContribution` and `currentNet` are never both called simply "net". A current
  member with no activity in a currency is an honest all-zeros row, not an absent one; a removed
  member with historical rows stays visible. Ordered by `consumed` then `paid`, descending.
- Settlements are not spending and never appear in the period/category buckets. Soft-deleted
  expenses are excluded.
- When the group has a display currency, there is a single block in that currency, each expense
  converted with its own id as the re-apportionment seed (so the charts agree with the balances
  tab to the minor unit), and the block carries `pins` — the same
  `{ fromCurrency, toCurrency, rate, asOf, source }` rows the balances endpoint returns — so the
  UI can label the figures as converted.
- `RATE_UNAVAILABLE` (`422`) if a currency present in the group's activity has no matching pin,
  the same as the balances endpoint.

---

## Settlements

```
POST   /api/groups/:id/settlements   { toUserId, amount, currency, settledOn, note? } → 201
PATCH  /api/settlements/:id                                                            → 200
DELETE /api/settlements/:id                                                            → 204
GET    /api/groups/:id/settlements   ?cursor=&limit=                                   → 200
```

`fromUserId` is always the authenticated user; recording a payment on someone else's behalf is
not in v1. Amount need not match any suggested plan edge — over- and under-payment are normal and
just move the net.

---

## Currency

```
PUT    /api/groups/:id/display-currency   { currency }        → 200 { group, pins[] }
DELETE /api/groups/:id/display-currency                        → 200 { group }
GET    /api/groups/:id/display-currency                        → 200 { currency, pins[], source }
GET    /api/groups/:id/fx-quote            ?from=USD&to=COP    → 200 { rate, asOf, source }
```

`GET`'s `source` is the FX provider a conversion would pin from — the Ajustes tab names it,
alongside today's date, in the convert confirmation *before* the write.

`GET /fx-quote` is a **read-only** rate quote for an arbitrary pair — `rate` is `to` units per
1 unit of `from`, as a `numeric(20,10)` string, with its `asOf` and `source`. The settle-up form
uses it to spell out "how much COP to wire" for a payment recorded in another currency (T104).
It derives the cross rate from the two USD legs (`ensureRate`, so a missing day lazily fetches
once), **never writes a pin**, and returns `RATE_UNAVAILABLE` rather than a stale number. `from`
or `to` outside `SUPPORTED_CURRENCIES` is `CURRENCY_NOT_SUPPORTED` (`422`); a malformed pair is
`VALIDATION_ERROR` (`400`).

`PUT` snapshots the rates for every currency present in the group and writes `group_fx_pins`. The
response returns the pins — rate, `asOf`, and `source` — because the UI has to be able to show
what it converted at.

Re-`PUT`ting the same currency **re-pins at today's rates**. That is the only thing that may move
an already-converted group's numbers, and it is always an explicit member action.

`DELETE` reverts to per-currency display. Pins are retained, not deleted.

| Code | Meaning |
|---|---|
| `RATE_UNAVAILABLE` | `422`. `details` names the missing `{ from, to, date }`. Never falls back to a stale rate silently. |
| `RATE_TOO_STALE` | `422`. Newest rate is older than the 7-day window for a **new** pin. |

---

## Admin

```
POST /api/admin/fx/refresh    Authorization: Bearer $FX_REFRESH_TOKEN   → 200 { inserted, asOf, source }
```

Idempotent per `(as_of, source)`. Returns `404` — not `401` — when `FX_REFRESH_TOKEN` is unset,
so a misconfigured deploy fails closed instead of exposing an open endpoint. Rate limited.

---

## Rate limits

| Endpoint | Key | Policy |
|---|---|---|
| `POST /api/auth/login` | IP | strict — Argon2 is expensive by design |
| `POST /api/auth/register` | IP | strict |
| `GET /api/invites/:code` | IP | moderate — it's unauthenticated and enumerable-looking |
| `POST /api/admin/fx/refresh` | token | very strict |
| everything else | user id | generous |

Client IP comes from `CF-Connecting-IP`. That header is only trustworthy because the app is
reachable exclusively through the tunnel; document that assumption wherever it's read, because it
stops being true the moment anything else can reach the container.
