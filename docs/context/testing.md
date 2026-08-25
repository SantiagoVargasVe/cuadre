# Testing

Vitest. Tests ship in the same commit as the code they cover. A task is done when CI is green,
not when it works locally.

## The one-line version

**`src/lib/money/` is where wrong answers hide.** Everything else in this app fails loudly when
it breaks; the money math fails by returning a number that looks fine. Test it accordingly.

## What gets tested

### Money math — `src/lib/money/` · gate 95%

Pure functions, no I/O, no excuse for thin coverage.

- Apportionment sums to the total **exactly**, for every strategy, across many `(total, weights)`
  combinations — especially totals that don't divide evenly
- Remainder rotation actually rotates: consecutive expenses don't hand the leftover unit to the
  same member
- Determinism: same expense id and inputs → identical output, run repeatedly
- `percentage` rejects basis points ≠ 10000; `exact` rejects sums ≠ total, and the error names the
  difference
- Simplification: at most `n−1` edges, terminates, deterministic ordering, and **every net
  position preserved**
- Pairwise attribution agrees with net balances per member
- Conversion preserves `Σ splits == total` after re-apportionment

### Property-based tests — required, not optional

The unit tests above check cases someone thought of. These check the invariants that must hold
for *every* ledger. Generate random groups (2–15 members), random expenses (random strategies,
payer counts, totals), random settlements, then assert:

```
Σ splits == total                     for every expense
Σ payers == total                     for every expense
Σ net over members == 0               for every currency
simplify(b) preserves every net in b
|simplify(b)| ≤ n − 1
Σ pairwise(m) == net(m)               for every member
convert(expense) still balances
```

This is the single highest-value test suite in the repo. If a task touches the money math and
doesn't extend these, it isn't finished.

### Backend — `src/server/` · gate 80% on services

1. **Authorization, exhaustively.** For every group-scoped endpoint: a non-member gets `404`, a
   removed member gets `404`, a member-not-owner gets `403` where owner is required. Include the
   id-addressed routes (`/api/expenses/:id`, `/api/settlements/:id`) — those are where the check
   gets forgotten.
2. **The balanced-expense trigger**, against a real database. Attempt an unbalanced write with the
   service bypassed; the transaction must abort.
3. **Invite consumption races.** Two concurrent registrations on one single-use code: exactly one
   succeeds, the other gets `409`.
4. **Member removal** with a non-zero balance is refused, in every currency.
5. **FX**: pins don't move when `fx_rates` gains newer rows; `RATE_UNAVAILABLE` rather than a
   stale-rate fallback; refresh is idempotent per `(as_of, source)`.
6. **Soft delete**: deleted expenses vanish from balances; revisions survive.

### Frontend — `src/app/`, `src/lib/`

- The split editor: each strategy produces the payload the API contract specifies, and the
  live preview matches what the server returns
- Money formatting: COP at 0 decimals, EUR under `es-CO`, the thousands separators
- Optimistic updates roll back and toast on failure
- Owner-only controls are absent, not merely disabled, for non-owners

**Don't test Base UI itself.** Whether a dialog traps focus is the library's problem.

## How

- **Test against a real Postgres**, never a mocked Drizzle. The invariants that matter most here —
  the deferred balance trigger, the composite membership FK, the conditional invite consumption —
  are enforced by the database. A mock accepts all of them happily.
- Integration tests use `cuadre_test`, created by `infra/postgres-init/` on a fresh volume and
  addressed by `DATABASE_URL_TEST`. They **skip** locally when it's unset, so unit tests still run
  without Docker, and they **fail** in CI when it's unset — a silent skip there is
  indistinguishable from a pass.
- No network in tests. FX providers are tested against recorded fixtures; the provider interface
  exists partly to make that easy.
- Query by role and label, not test ids. Test behaviour a user can observe.
- Money assertions compare `bigint`s, never formatted strings. `expect(x).toBe(10000000n)`.

## Thresholds

| Path | Coverage |
|---|---|
| `src/lib/money/**` | 95% |
| `src/server/services/**` | 80% |
| everything else | not gated |

Gated in `vitest.config.ts` and enforced by `npm run test:ci`. A plain `npm test` does not check
thresholds — run `test:ci` before opening a PR.

## CI

Lint · typecheck · test (with coverage) · build. All four must pass. `DATABASE_URL_TEST` is set
in CI against a Postgres service container, so integration tests run for real.

## Writing tests as you go

Each task's acceptance criteria name the tests that task owes. If you find yourself finishing a
task and then wondering what to test, the task was picked up in the wrong order — the criteria
were written first for a reason.
