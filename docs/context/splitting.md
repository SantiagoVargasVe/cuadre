# Splitting, Balances, and Simplification

**Read this in full before touching anything under `src/lib/money/` or
`src/server/services/{expenses,balances,settlements}`.**

This is the one part of the codebase where a bug produces *plausible wrong numbers* instead of an
error. Everything here is specified to the minor unit, and everything here is a pure function.

---

## 1. Money representation

A money value is **an integer count of minor units plus an ISO-4217 code**. Nothing else is a
money value. Not a float, not a `numeric`, not a formatted string.

```ts
type Money = { amount: bigint; currency: CurrencyCode };
```

| Currency | ISO exponent | 1 major unit = | Displayed as |
|---|---|---|---|
| COP | 2 | 100 minor | `$ 150.000` — **0 decimals** |
| USD | 2 | 100 minor | `$86.45` |
| EUR | 2 | 100 minor | `€45,00` |

**COP is stored with two decimals and displayed with none, deliberately.** ISO 4217 assigns COP a
minor unit of 2. Colombians never write centavos, so the UI formats it at 0 decimals — but the
*storage* keeps them, because a conversion out of USD lands on fractional pesos and throwing them
away at write time makes round-trips lossy. `150.000 COP` is `15000000n`.

> **Verified gotcha:** `Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' })`
> renders `$ 150.000,00` — CLDR gives COP two fraction digits. You **must** pass
> `maximumFractionDigits: 0` explicitly. Also note `EUR` under `es-CO` renders as `EUR 45,00`,
> not `€45,00`. Both are handled once in the shared formatter; never call `Intl` directly in a
> component.

**Across the wire, amounts are strings**: `{ "amount": "15000000", "currency": "COP" }`. JSON
numbers are IEEE-754 doubles, and COP minor units reach past `Number.MAX_SAFE_INTEGER` faster
than feels comfortable. Parse to `bigint` at the boundary, never to `Number`.

All amounts are **strictly positive**. A negative expense is not a refund — model a refund as a
settlement in the opposite direction.

---

## 2. The balanced ledger invariant

Every expense has a list of payers and a list of splits.

```
sum(payers[].amount) == expense.total == sum(splits[].amount)
```

**Exactly.** Not "within a cent". This is asserted:

1. In `src/lib/money/` before the service is allowed to persist anything
2. Inside the write transaction, after the rows are inserted
3. By a database constraint, so a future code path can't bypass it

A violation aborts the transaction. There is no "close enough" branch, and no code anywhere
should absorb a discrepancy by adjusting a member's share after the fact.

The same invariant is what makes `sum(net balances) == 0` hold for the whole group, which is
itself asserted every time balances are computed.

---

## 3. Split strategies

All six strategies produce the same thing — a list of `(memberId, amount)` summing exactly to the
total. They differ only in how the weights are derived.

| Strategy | Input | Notes |
|---|---|---|
| `equal` | member ids | The default. Every member of the group, equal weight. |
| `equal_subset` | member ids | Same, over a chosen subset ("just the four of us"). |
| `shares` | integer weight per member | "The couple counts as two." Weights must be ≥ 1. |
| `percentage` | basis points per member | Must sum to exactly `10000`. Stored as integers — never a float percentage. |
| `exact` | minor units per member | Must sum to exactly the total. Rejected with `422` otherwise. |
| `loan` | one beneficiary | Sugar for: one payer, one split member at 100%. |

`equal`, `equal_subset`, `shares` and `percentage` all reduce to **one apportionment function**.
`exact` skips it (the caller supplied the answer). `loan` is a UI affordance over a one-member
split — it is not a distinct row type, and there is no `is_loan` column.

### 3.1 The apportionment rule

Given a total `T` and integer weights `w₁..wₙ` with `W = Σwᵢ`:

```
base_i      = (T * w_i) / W          // integer division, floors
remainder_i = (T * w_i) % W          // the fractional part, kept exact as an integer
R           = T - Σ base_i           // units still to hand out; 0 ≤ R < n
```

Hand the `R` leftover units out by the **largest remainder method**: sort by `remainder_i`
descending, give one extra unit to each of the first `R`.

**Ties are broken by rotation, not by member id.** This matters more than it looks:

- With an `equal` split, *every* remainder is identical, so the whole thing is one big tie. Break
  it by member id and the same unlucky member absorbs the extra peso on every single expense
  forever.
- So: derive a stable offset from the expense id, `offset = uint32(expenseId) % n`, and walk the
  tied members starting at `offset` in member-id order, wrapping around.

This is **deterministic** — the same expense always apportions identically, so recomputing
balances is stable and a migration can never shuffle history — and it is **fair on average**,
because the offset varies across expenses.

> Sorting by member id inside each tie group is what keeps it deterministic; the offset is what
> keeps it fair. You need both. Dropping either one is a bug that no single-expense test catches.

### 3.2 Worked example

`equal` split of `100.000 COP` (`10000000n`) among Ana, Beto, Caro:

```
T = 10000000, w = [1,1,1], W = 3
base       = 3333333 each  (Σ = 9999999)
R          = 1
remainders = [1, 1, 1]     → all tied
offset     = uint32(expenseId) % 3 = 1
            → the extra unit goes to the member at index 1 (Beto, by member-id order)

Ana  3333333  ($ 33.333)
Beto 3333334  ($ 33.333)   ← absorbs the leftover centavo
Caro 3333333  ($ 33.333)
                Σ = 10000000 ✓
```

The next expense in the group gets a different offset, so Beto is not permanently the one.

`percentage` 60/40 on `100.00 USD` (`10000n`):

```
T = 10000, bp = [6000, 4000], W = 10000
base = [6000, 4000], Σ = 10000, R = 0 → done, no remainder to place
```

---

## 4. Balances

For each member `m` and currency `c`:

```
paid(m,c)      = Σ expense_payers.amount      where payer_id = m
owed(m,c)      = Σ expense_splits.amount      where member_id = m
sent(m,c)      = Σ settlements.amount         where from_id = m
received(m,c)  = Σ settlements.amount         where to_id   = m

net(m,c) = paid(m,c) − owed(m,c) + sent(m,c) − received(m,c)
```

- `net > 0` — the group owes this member. They're a **creditor**.
- `net < 0` — this member owes the group. They're a **debtor**.
- `Σ net over all members == 0`, for every currency. **Assert this**; if it ever fails, the ledger
  is corrupt and the correct response is to fail the read loudly, not to display a plausible
  number.

Soft-deleted expenses are excluded (`deleted_at IS NULL`). Every balance query goes through a
`liveExpenses` helper so it can't be forgotten.

### 4.1 Two views of the same balances

**Raw (simplify off)** — pairwise net debts, so the plan mirrors what actually happened.

Within one expense, member `s` owes payer `p` a share of `s`'s split proportional to what `p`
put in:

```
owes(s → p) = apportion(split_s, weights = [paid_p for each payer p])
```

using the same rule as §3.1. Then net each ordered pair across all expenses and settlements, and
drop pairs that net to zero.

This is self-consistent by construction: `Σ_p owes(s→p) = split_s`, and `Σ_s owes(s→p) = paid_p`.
So **the pairwise view and the net view always agree per member.** That identity is a test, not a
comment.

**Simplified (simplify on)** — see §5.

---

## 5. Debt simplification

### The algorithm

Greedy largest-debtor / largest-creditor matching over net balances:

```
debtors   = [(m, −net) for net < 0], sorted desc
creditors = [(m,  net) for net > 0], sorted desc

while both non-empty:
    d = largest debtor, c = largest creditor
    x = min(d.amount, c.amount)
    emit  d.member → c.member : x
    subtract x from both; drop either if it hits 0
```

Ties in the sort are broken by member id, so the output is **deterministic** — the same balances
always yield the same plan. Members do not see the payment plan reshuffle on refresh.

### Properties worth knowing

- It emits **at most n−1 payments** for n members with non-zero balances, always.
- It terminates: each iteration zeroes at least one participant.
- Every member's net position is **unchanged**. Simplification only re-routes who hands money to
  whom; it never alters what anyone is up or down. This is the property that makes the toggle
  safe, and it should be verified by a property test over random ledgers.
- **It does not always minimize the number of payments.** Doing that optimally is NP-hard — it
  contains subset-sum. The greedy is what Splitwise-class apps use, and `n−1` is a good enough
  bound that nobody notices the difference at group scale. Don't "fix" this with a search;
  do not spend exponential time on a six-person trip.

### Why it is never stored

Simplification is a **pure function of the net balances**, computed on read.
[ADR-0006](../adr/0006-simplification-is-derived.md) covers the reasoning; the short version is
that a stored simplified debt is a second source of truth that can disagree with the ledger, and
the toggle would then have to *un*-derive it. Deriving it every time makes "off" and "on" the
same data seen two ways.

### The social caveat — surface it in the UI

Simplification can tell Caro to pay Ana when Caro never had any expense with Ana. That is
arithmetically correct and socially surprising. The UI must be able to explain a simplified edge
("you owe Ana 40.000 — this replaces what you owed Beto and what Beto owed Ana"), which is why
the raw pairwise view has to keep working even while simplify is on.

### Interaction with settlements

None — and that is the point. A settlement is a ledger entry between two members, so it changes
net balances the same way whether simplify is on or off. A member can pay along a simplified
edge, toggle simplify off, and the raw view still nets correctly. There is no reconciliation step
and no "this settlement belonged to a simplified plan" state to track.

---

## 6. Multi-currency balances

**A group with no display currency computes balances independently per currency.** Ana can be
owed COP and owe USD at the same time; those are two separate plans and must not be summed. The
API returns a balance set keyed by currency and the UI shows them as separate blocks.

**A group with a display currency converts first, then computes once.** Conversion happens at the
*row* level, not on the net:

```
for each expense not already in the display currency:
    converted_total = convert(expense.total, pinned_rate)
    converted_splits = apportion(converted_total, weights = original split amounts)
    converted_payers = apportion(converted_total, weights = original payer amounts)
```

Re-apportioning by the original amounts as weights is what keeps the balanced-ledger invariant
true *after* conversion, for every strategy including `exact` — and it needs no knowledge of which
strategy produced the split. Converting each split row independently would not: three converted
rows can easily miss their converted total by a unit.

Settlements convert the same way (single amount, nothing to apportion).

The conversion arithmetic, rate pinning, and rounding mode are specified in
[currency.md](currency.md).

---

## 7. Settlements

A settlement is `from → to`, one amount, one currency, one date. It is a ledger entry, not a flag
on a debt ([ADR-0009](../adr/0009-settlements-are-ledger-entries.md)).

- It is **not** attached to an expense or to a plan edge. It just moves net position.
- It may over- or under-shoot what was suggested. Someone paying a round `50.000` against a
  `47.300` debt is normal; the remainder simply flips sign.
- It can be edited and deleted like an expense, with the same soft-delete and versioning rules.
- A settlement between two members who are not both in the group is rejected.

---

## 8. What must be tested

`src/lib/money/` is pure, so there is no excuse for thin coverage here. Gate it at 95%.

**Unit**
- Apportionment sums to the total exactly, for every strategy, across many `(T, weights)` pairs
- The rotation offset actually rotates — the same member does not absorb the remainder on
  consecutive expenses
- Determinism: same expense id, same input → byte-identical output, every time
- `percentage` rejects basis points not summing to `10000`; `exact` rejects sums ≠ total, and the
  error names the difference
- Simplification: at most `n−1` edges, terminates, and preserves every net position
- Pairwise view and net view agree per member

**Property-based** — this is where the real bugs are. Generate random ledgers (random members,
totals, strategies, payer counts) and assert the invariants that must hold for *all* of them:

```
Σ splits == total                       for every expense
Σ net over members == 0                 for every currency
simplify(balances) preserves every net
Σ pairwise(m) == net(m)                 for every member
convert(...) preserves Σ splits == total
```

**Integration** — against a real Postgres, because the balanced-expense constraint is enforced by
the database and a mocked Drizzle will happily accept an unbalanced write.
