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
```

`register` consumes the invite code in the same transaction that creates the user — and, if the
code carries a `groupId`, adds the membership too. All three commit together or none do.

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
GET    /api/groups/:id/expenses    ?cursor=&limit=  → 200 { items[], nextCursor }
POST   /api/groups/:id/expenses                     → 201 { expense }
GET    /api/expenses/:id                            → 200 { expense }
PATCH  /api/expenses/:id                            → 200 { expense }
DELETE /api/expenses/:id                            → 204
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
  "strategy": "equal", "version": 1, "editedAt": null
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
  "editedAt": null, "editedBy": null,
  "converted": null
}
```

`editedAt`/`editedBy` are `null` for a never-edited expense (`version === 1`); otherwise `editedAt`
is the last edit's timestamp and `editedBy` is `{ userId, displayName }` — on **every** row, not
just the single-expense detail, so the feed can show its own "editado" marker without a second
fetch per row. `editedBy` can still be `null` on an edited expense if the editor's account no
longer exists (`updated_by`'s FK is `ON DELETE SET NULL`) — "when" and "who" are independent.

The single-expense detail (`GET /api/expenses/:id`, and the `PATCH`/`POST` responses) additionally
carries `version`.

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
