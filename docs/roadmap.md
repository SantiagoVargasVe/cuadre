# Roadmap

Sequencing and rationale. The task-level detail lives in [../backlog/README.md](../backlog/README.md);
this is why the phases are ordered the way they are.

## Principle

**The ledger has to be trustworthy before anything is built on top of it.**

Every feature in this app is downstream of one question: does `Σ splits == total` hold, and does
`Σ net == 0` hold? Charts of wrong numbers are worse than no charts, and a CSV export of a broken
ledger is a broken ledger someone can now email to five people. So the money math lands early and
the presentation lands late, which is the opposite of the order it's tempting to build in.

---

## M0 · Foundation — E1

Next.js, Postgres, Drizzle, validated config, UI primitives, real-Postgres test harness.

Nothing product-facing. The point is that by the end of it, a task can be picked up and tested
without any setup archaeology.

## M1 · Identity — E2

Users, invite codes, register, login, JWT (cookie + bearer), session and membership guards, auth
pages.

Ships with the guards, not before them. Membership checks are this app's entire authorization
model, and retrofitting them onto endpoints written without them is how one gets missed.

## M2 · Groups — E3

Groups, members, roles, the unified group/registration invite, `/join/[code]`.

**First point at which a real person can do something**: get invited, register through the link,
and land in a group. Worth deploying to the box here even though the group is empty, because the
onboarding link is the flow most likely to be subtly broken in production.

## M3 · The money math — E4

Money primitives, the expense ledger schema with its deferred balance trigger, every split
strategy, and expense CRUD.

**The highest-risk milestone in the project.** It is also almost entirely pure functions and
database constraints, so it is the most testable — property tests land here, not later. If this
milestone slips because the property tests are hard to satisfy, that is the system working.

## M4 · Balances and settling — E5

The balance engine, pairwise attribution, greedy simplification, settlements, the balances
endpoint.

Depends on M3 being right. Every invariant here (`Σ net == 0`, simplification preserving every net
position, pairwise agreeing with net) is a property test over random ledgers.

At the end of M4 the product is complete as an API. It has no usable interface.

## M5 · Currency — E6

`fx_rates`, the provider interface, the daily refresh, display currency and pinned rates,
conversion on the read path.

**After** balances, deliberately. Conversion re-apportions rows and then feeds the same balance
engine, so it composes onto a working engine instead of complicating an unfinished one. A group
that never leaves COP — most groups — never touches this code.

## M6 · The app — E7

Shell and i18n, groups list, group detail and feed, the expense form and split editor, balances
view, settle-up, the currency switcher and simplify toggle, invite UI.

The largest milestone by task count and the one where the product is won or lost. The expense form
is the screen that decides whether anyone uses this: the common case must cost nothing, and the
flexible machinery must be reachable in one tap.

## M7 · Live — E8

Dockerfile, CI, GHCR release, compose and the pull timer, the FX refresh timer, the tunnel
hostname.

**Ships against a real trip.** The definition of done for v1 is in
[product.md](context/product.md) — six people, two currencies, awkward splits, simplify on,
settle up, balances at zero.

---

## Post-MVP

Ordered by expected value, not by ease. Nothing here starts before M7 is real and a group has used
it for an actual trip — several of these will change shape once that happens, and some will turn
out not to be wanted.

### E9 · Insights

Charts and CSV export, both explicitly deferred from the original requirements.

- Spend over time, by member, by category
- Per-member breakdown: what they paid for, what they consumed
- **CSV export** of a group's expenses — the most-requested thing in every app of this kind, and
  the escape hatch that means nobody is trapped by this software
- The expense revision history as a visible diff, building on what M3 already records

**Charting library: none — decided 2026-09-01**, against the real requirements as this section
asked. A bar series over time, a horizontal bar per member and a per-category breakdown are a few
dozen lines of hand-rolled SVG over aggregates the server already computes. Recharts would cost
~100 KB gzipped, pull in D3 submodules, and fight both the OKLCH tokens and the measured contrast
rules in design-system.md — and a new runtime dependency needs an ADR under architecture.md, which
hand-rolled SVG does not. T081 owns the shared primitives; T082 and T084 consume them.

### E10 · Quality of life

- **Categories** on expenses — a prerequisite for the more interesting half of E9. **A fixed,
  app-provided set, decided 2026-09-01**: `comida, alojamiento, transporte, mercado, actividades,
  otro`. Free-form tags were rejected — they produce `comida`/`Comida`/`food` in one trip and push
  a normalisation step onto the charts that nobody will write. See T090
- **Receipt photos** — introduces a file-storage mount and its permission traps; read how that
  went in the sibling repo first
- **Recurring expenses** for longer trips and shared households
- **Comments on an expense** — where the "wait, that wasn't 200" conversation currently happens in
  WhatsApp
- **Notifications** — needs SMTP or push, neither of which this repo owns today
- **PWA / offline add** — expenses get added in restaurants with bad wifi; a queued offline write
  is genuinely useful and genuinely fiddly

### E12 · First use

Written after the first real session on the deployed app, 2026-08-31 — the milestone the whole
plan was pointed at ("ships against a real trip"). It is exactly the correction the post-MVP
ordering above expected: *"expect the shape to have changed once a real trip has run through the
app."*

What the first session actually surfaced, in priority order:

- **Currency is ambiguous on screen.** `es-CO` with `currencyDisplay: "narrowSymbol"` renders
  both COP and USD as `$`. A 100.000 COP expense and an 80 USD one are typographically
  indistinguishable. This is the one to fix first — it is a trust bug, not a formatting nit.
- **Nothing looks interactive.** Tailwind v4 dropped `cursor: pointer` from Preflight and nothing
  opted back in. The visible cost is that a whole feature — the split breakdown behind a tap on
  an expense row — was never discovered.
- **Settling across currencies is awkward.** The currency of a payment is decided by which button
  you happen to press, and nothing tells you what to actually wire from a COP bank account.
- **The display-currency switch undersells itself**, reading like a formatting preference when it
  recomputes every balance and the payment plan, for every member.
- **Tab switches feel slow** — no prefetch, no loading boundary, and the same two endpoints
  refetched on every tab.
- **Members are hard to scan** in lists that are just columns of names.

These come before E9 and E10. Charts and categories on top of an interface people misread is the
same mistake as charts on top of a ledger people don't trust.

### E13 · Code health

A `react-doctor` static-analysis pass over `main`, 2026-09-01 — 67 findings across 20 rules,
triaged rather than swept because most don't apply here. `server-sequential-independent-await`
fired 28 times and is almost entirely `await context.params` (already resolved in Next 15)
followed by `await requireUserId` (synchronous crypto) — no wall-clock to reclaim; the one
service that *looks* parallelisable, `exportExpensesCsv`, must not be, because its first `await`
is the membership gate. `js-combine-iterations` and `async-await-in-loop` are micro-optimisations
over arrays the size of a group or a once-a-day cron. The hydration-flicker hits are deliberate
`nanoid` / `next-themes` guards with comments already explaining them.

What survives triage is small and real, and is **T111**: the deprecated `z.string().email()`
form (Zod is on v4), two plain `<a>` tags between `/login` and `/register`, a few dead exports,
and three service reads that genuinely are independent of each other once the auth check has
passed. One structural item earns its own change — `SplitEditor` mirrors its state up to the
expense form through a callback inside a `useEffect`; lifting that state is **T112**, kept
separate because it touches the money path. The task files carry the full list of dismissed
findings so the pass doesn't get re-run from zero.

### E11 · Bigger questions

Real design work, not backlog items. Written down so they're not rediscovered as bugs.

- **Cross-group balances.** "You and Ana across all trips" is obvious to ask for and ambiguous to
  define: netting across groups means people who never agreed to net with each other end up doing
  so. Deliberately out of scope for v1 ([product.md](context/product.md)).
- **User deletion.** Orphans ledger rows in other people's groups. Needs a real answer about what
  a departed member's history looks like before anything is built.
- **Per-member display currency.** Rejected for v1 because two members reading different totals for
  the same debt is a support burden. If it ever returns, the payment plan must still be computed
  in exactly one currency.
- **Password reset.** Needs SMTP the repo doesn't own. Today recovery is an operator action.
- **Multiple instances.** Migrations run at startup, which races with replicas. Moving them to a
  release step is the prerequisite for ever running two containers.
