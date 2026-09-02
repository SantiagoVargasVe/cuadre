# Backlog

One markdown file per task in [tasks/](tasks/). Each is written to be picked up **cold** — by a
person or an agent — without reading this conversation or any other task.

## Task format

Frontmatter plus four sections. See [_template.md](_template.md).

```yaml
---
id: T0NN
title: Resolve split strategies into per-member amounts
epic: E4-money
status: todo          # todo | in-progress | blocked | done
depends_on: [T030]
size: M               # S (<2h) | M (half day) | L (multi-day)
---
```

Body: **Context** (why, and what to read) · **Acceptance criteria** (checkable) ·
**Out of scope** (what not to touch) · **Files likely touched**.

A task is well-written if you can paste it into a fresh agent session with no other context and
get something reviewable back. If it needs "as we discussed," it's not done being written.

## Lifecycle

1. Pick a `todo` task whose `depends_on` are all `done`
2. **Branch off `main`**: `feat/T033-create-expense`
3. Set `status: in-progress`
4. Build it. Read only the docs the task's Context names.
5. **Write the tests in the same commit** — see [testing.md](../docs/context/testing.md)
6. Set `status: done` **in the same commit as the code**, so status never drifts from reality
7. Reference the id in the commit: `feat(expenses): create endpoint [T033]`
8. **Open a PR.** Never push to `main` directly — Santiago reviews and merges.

A task is done when CI is green on the PR, not when it works locally.

Run `npm run test:ci` before opening one — it mirrors CI exactly, **including coverage
thresholds**, which a plain `npm test` does not check.

### Branch naming

`<type>/<task-id>-<short-slug>` — `feat/T033-create-expense`, `fix/T042-simplify-tie-break`,
`chore/T002-local-postgres`. One task per branch, one PR per task. If a task turns out to need
splitting, write the second task file and open a second PR rather than growing the first.

### PR description

State the task id, what changed, and how you verified it. If you deviated from the task's
acceptance criteria, say so explicitly and why — that's the part a reviewer can't reconstruct.

If you discover work outside the task's scope, write a new task file rather than widening the
current one. Scope creep inside a task is how tasks stop being self-contained.

## Read this before picking up anything in E4, E5, or E6

Those three epics are the money math, and they are the reason this repo has the docs it has.

**[docs/context/splitting.md](../docs/context/splitting.md) is mandatory** — it specifies the
arithmetic to the minor unit, including the remainder rule, the balance invariants, and the
simplification algorithm. A task in these epics that "works" but doesn't satisfy the invariants in
§8 is not done, and the property tests in [T032](tasks/T032-property-invariants.md) are what
establish that.

## Epics

| Epic | What | Tasks | Milestone |
|---|---|---|---|
| **E1** foundation | Next.js, Postgres, Drizzle, UI primitives, test harness | T001–T004 | M0 |
| **E2** auth | Users, invite codes, register/login, JWT, guards, auth pages | T010–T014 | M1 |
| **E3** groups | Groups, members, invites, join flow | T020–T025 | M2 |
| **E4** money | Money primitives, split strategies, expense ledger, CRUD | T030–T036 | M3 |
| **E5** balances | Balance engine, pairwise view, simplification, settlements | T040–T044 | M4 |
| **E6** currency | `fx_rates`, providers, daily refresh, display currency, conversion | T050–T054 | M5 |
| **E7** frontend | Shell, groups, feed, expense form, split editor, balances, settle up | T060–T068 | M6 |
| **E8** deploy | Dockerfile, CI, GHCR, compose, timers, tunnel | T070–T076 | M7 |
| **E9** insights | Charts, CSV export, revision diffs | T080–T084 | post-MVP |
| **E10** quality-of-life | Categories, receipts, recurring, comments, notifications, PWA | T090–T095 | post-MVP |
| **E12** first-use | Fixes and clarity from the first real use of the deployed app | T100–T109 | post-MVP |

Sequencing rationale is in [docs/roadmap.md](../docs/roadmap.md). The short version: the ledger
has to be trustworthy before anything is built on top of it, so the money math lands in M3–M4 and
the UI lands in M6.

## Task index

**E1 — Foundation** · M0
- `T001` Initialize Next.js 15 + TypeScript + Tailwind + Vitest
- `T002` Local Postgres + validated environment config
- `T003` Drizzle wiring, migration pipeline, real-Postgres test harness
- `T004` Base UI primitives, tokens, dark mode, TanStack Query client

**E2 — Auth** · M1
- `T010` Schema: `users`, `invite_codes` + `seed:invite` script
- `T011` `POST /api/auth/register` with transactional invite consumption
- `T012` Login / logout / me, JWT as cookie **and** bearer, Origin check
- `T013` Session helper, typed domain errors, and the error → HTTP mapper
- `T014` `/login` and `/register` pages

**E3 — Groups** · M2
- `T020` Schema: `currencies` seed, `groups`, `group_members`
- `T021` Membership guards — `requireMembership` / `requireOwner`
- `T022` Group CRUD
- `T023` Invite minting, public lookup, and acceptance
- `T024` Member management and removal with a balance guard *(needs T040 — the one E3 task that
  can't land until E5)*
- `T025` `GET /api/groups` and the group detail aggregate *(also needs T040 — `yourNet` is a
  balance)*

**E4 — Money and expenses** · M3 — *the highest-risk epic in the project*
- `T030` Money primitives: `bigint` minor units, parsing, wire format
- `T031` Apportionment and the six split strategies
- `T032` Property-based invariant harness
- `T033` Expense schema, deferred balance trigger, composite membership FKs
- `T034` `POST /api/groups/:id/expenses`
- `T035` Edit and delete with `expense_revisions`
- `T036` Expense list and detail endpoints

**E5 — Balances and settlements** · M4
- `T040` Balance engine — net per member, per currency
- `T041` Pairwise attribution (the raw, un-simplified view)
- `T042` Debt simplification
- `T043` Settlements schema and endpoints
- `T044` `GET /api/groups/:id/balances`

**E6 — Currency and FX** · M5
- `T050` `fx_rates` schema and scaled-integer rate parsing
- `T051` FX provider interface, `open.er-api.com`, TRM cross-check
- `T052` Refresh endpoint, lazy fallback, `fx:refresh` script
- `T053` Display currency and pinned rates
- `T054` Conversion on the balance read path

**E7 — Frontend** · M6
- `T060` App shell, layout, i18n scaffolding (Spanish-first)
- `T061` Money formatting: `<Money>` and `<MoneyField>`
- `T062` `/groups` — your groups and your net position
- `T063` `/g/[groupId]` — group detail and expense feed
- `T064` Expense form — the common case in under fifteen seconds
- `T065` The split editor — all six strategies
- `T066` Balances view and the simplify toggle
- `T067` Settle-up flow
- `T068` Group settings: members, invites, currency switcher

**E8 — Deploy** · M7
- `T070` `infra/Dockerfile` (multi-stage, Next standalone)
- `T071` CI workflow: lint, typecheck, test, build
- `T072` Release workflow → GHCR on CI success
- `T073` Production compose + deploy pull timer
- `T074` FX refresh systemd timer
- `T075` Add the app hostname to the Cloudflare Tunnel *(manual)*
- `T076` Unique prod compose service key (`app` → `cuadre-app`) — a generic service key becomes a
  network alias the shared `cloudflared` can resolve to the wrong stack; it 502'd Nextcloud on
  2026-08-30. Also repoints `cuadre-fx-refresh`, which execs the service by key.

**E9 — Insights** · post-MVP

Deferred from the original requirements on purpose — see [roadmap.md](../docs/roadmap.md). Charts
of an untrustworthy ledger are worse than no charts.

- `T080` CSV export of a group's expenses — the escape hatch that means nobody is trapped by
  this software. The most valuable item in this epic; do it first.
- `T081` Spend over time, by member, and by category — **owns the shared SVG chart primitives**
- `T082` Per-member breakdown: what they paid for vs. what they consumed
- `T083` Expense revision history as a visible diff (the data already exists from T035)
- `T084` Group summary card — totals, biggest expense, who's carrying the trip

**No charting library** — decided 2026-09-01. The three shapes E9 needs are a few dozen lines of
SVG each over server-computed aggregates; Recharts costs ~100 KB and fights the OKLCH tokens and
the measured contrast rules in design-system.md. Reversing this needs an ADR.

**E10 — Quality of life** · post-MVP

- `T090` Categories on expenses — a **fixed, app-provided set** (`comida, alojamiento,
  transporte, mercado, actividades, otro`), not free-form tags; decided 2026-09-01. A
  prerequisite for the interesting half of E9
- `T091` Receipt photos — introduces a file-storage mount; read how that went in the sibling repo
  before designing it
- `T092` Recurring expenses — *a full spec was drafted 2026-09-01 and deliberately not adopted:
  the exactly-once materialization and external-trigger machinery costs more than the feature is
  worth until a real group asks for it. Don't re-propose it as a task file without that signal.*
- `T093` Comments on an expense — where "wait, that wasn't 200" currently happens in WhatsApp.
  *Spec also drafted 2026-09-01 and deliberately not adopted — same call as T092.*
- `T094` Notifications — needs SMTP or push, neither of which this repo owns today
- `T095` PWA / offline expense queue — expenses get added on bad restaurant wifi

T080–T084, T090, and T095 now have full task files, written 2026-09-01 against the shape the first
real trip actually left behind. **T091–T094 remain one-liners deliberately** — expand one into a
task file when it is picked up, following [_template.md](_template.md).

**T095 is the lowest-priority item in E10 and is not ready to pick up.** The offline
create-expense queue is genuinely useful and genuinely fiddly; it sits behind categories (T090)
and the whole of E12. Its task file exists so the idempotency and service-worker cache-safety
constraints are captured while they're fresh — not because it's next in line.

**E12 — First use** · post-MVP

Written from the first real session on the deployed app (2026-08-31). Unlike E9/E10 these are
full task files, because each one names a defect that was reproduced rather than a feature that
was imagined. Several turned out to be more specific than the report suggested — the currency one
in particular.

*Do these first — small, independent, each one removes a daily papercut:*
- `T100` Restore pointer cursors — Tailwind v4 dropped them from Preflight and nothing opted back
  in, so nothing in the app reads as clickable
- `T101` **Name the currency on every amount.** Under `es-CO` with `narrowSymbol`, COP and USD
  both render as `$` — measured. Two different currencies format identically today
- `T102` Make the split breakdown discoverable — it already exists behind a tap on an expense
  row; nobody found it, largely because of T100
- `T103` The settle-up recipient select shows a UUID instead of the member's name

*Then:*
- `T104` Settle up in any of the group's currencies, with the transfer amount spelled out. Read
  its Context before touching it — recording a COP settlement does **not** reduce a USD debt
- `T105` Explain what the display-currency switch actually changes (balances and the plan, for
  everyone — not just formatting)
- `T106` Kill the tab-switch delay — no prefetch, no `loading.tsx`, and every tab refetches the
  same two endpoints
- `T107` Deterministic generated avatars via `boring-avatars`, seeded by `userId` (an
  email-seeded one is impossible: no endpoint returns a co-member's email). One good default,
  no schema change
- `T108` Avatar editor — a grid of live candidates across the six `boring-avatars` variants with
  a reroll, not a dropdown. App-generated seeds only, and **never an upload**
- `T109` Grow `/cuenta` (the personal-settings surface T108 created) into a real settings page —
  display-name editing first. Spun off from T108 rather than growing it
- `T110` Edit and delete expenses from the expense detail — complete the UI for T035's versioned
  full-replacement edits and soft deletes

Open design questions that are **not** backlog items — cross-group balances, user deletion,
per-member display currency, password reset, multi-instance — are listed in
[roadmap.md](../docs/roadmap.md) § E11.
