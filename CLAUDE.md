# Cuadre — Agent Context

Group expense splitting for trips and shared activities. A group records who paid for what and
how it was split; the app derives who owes whom, and can simplify those debts into fewer
payments. Multi-currency (COP / USD / EUR), Spanish-first.

Runs on Santiago's home server (Debian 13, Docker) behind the existing Cloudflare Tunnel.

## Read before you start

Load the docs relevant to your task. Do **not** read all of them by default.

| Doc | Read it when |
|---|---|
| [docs/context/product.md](docs/context/product.md) | You need to know what a feature is *for* |
| [docs/context/architecture.md](docs/context/architecture.md) | Touching deployment, boundaries, or adding a dependency |
| [docs/context/data-model.md](docs/context/data-model.md) | Any DB or entity work |
| [docs/context/splitting.md](docs/context/splitting.md) | **Mandatory** for anything that touches money, splits, balances, or simplification |
| [docs/context/currency.md](docs/context/currency.md) | FX rates, the display-currency conversion, the refresh job |
| [docs/context/api-contract.md](docs/context/api-contract.md) | Adding or changing an endpoint |
| [docs/context/security.md](docs/context/security.md) | **Mandatory** for auth, invites, or anything reading another user's data |
| [docs/context/testing.md](docs/context/testing.md) | Writing tests, or wondering what needs them |
| [docs/frontend/design-system.md](docs/frontend/design-system.md) | **Mandatory** before writing any component |
| [docs/adr/](docs/adr/) | You're about to contradict a past decision |
| [docs/roadmap.md](docs/roadmap.md) | Sequencing — what lands when, and what's deliberately later |

`docs/frontend/CLAUDE.md` and `docs/backend/CLAUDE.md` load automatically when you work in
those areas. Don't read the other side's conventions unless you're crossing the boundary.

## Stack

Next.js 15 (App Router) · TypeScript · Tailwind v4 · Base UI · TanStack Query ·
react-hook-form + Zod · Drizzle ORM · PostgreSQL 17 · Vitest · Docker

One container serves both the UI and the API. The internal boundary is enforced by directory,
not by network:

```
src/app/          routes + UI      → docs/frontend/
src/server/       domain + data    → docs/backend/
src/lib/money/    pure money math  → docs/context/splitting.md
```

**`src/app/` must never import from `drizzle` or talk to the DB directly.** It calls into
`src/server/` services. This is the boundary that keeps FE and BE context separable.

## Non-negotiables

These come from decisions already made. Changing one means writing an ADR first.

1. **Money is an integer count of minor units** (`bigint`) plus an ISO-4217 code. Never a float,
   never `numeric`, never a formatted string. A split that doesn't sum exactly to its total is a
   bug, not a rounding artifact. See [ADR-0004](docs/adr/0004-money-as-integer-minor-units.md).
2. **Every expense is a balanced ledger entry.** `sum(payers) == sum(splits) == total`, asserted
   in the same transaction that writes it. There is no `paid_by` column — one payer is just the
   common case of N. See [ADR-0005](docs/adr/0005-expense-as-balanced-ledger-entry.md).
3. **Debt simplification is derived at read time and never stored.** No table, no column, no
   migration writes a simplified debt. That's the only thing that makes the toggle honestly
   reversible. See [ADR-0006](docs/adr/0006-simplification-is-derived.md).
4. **An expense is always stored in the currency it was entered in.** Converting a group changes
   a *display* setting plus a pinned rate snapshot — it never rewrites an expense row. See
   [ADR-0007](docs/adr/0007-reversible-display-currency.md).
5. **A pinned rate is never silently refreshed.** Once a group converts, its totals stop moving
   until a member explicitly re-pins. This is a product promise, not an optimization.
6. **Group data is member-only.** Every service that reads or writes anything group-scoped takes
   the acting `userId` and verifies membership *inside the service*. See
   [docs/context/security.md](docs/context/security.md).
7. **Expenses soft-delete** (`deleted_at`) and edits are versioned. Shared-money history is the
   product; a silent overwrite of who-owed-what is the worst bug this app can have.
8. **No secrets in the repo.** `.env.example` is committed; `.env` is not.
9. **Components are ≤ 100 lines**, one per file, enforced by ESLint `max-lines`. The limit is a
   forcing function for composition — see [design-system.md](docs/frontend/design-system.md).
10. **Tests ship in the same commit as the code.** A task is done when CI is green, not when it
    works locally. See [testing.md](docs/context/testing.md).
11. **This repo is public.** No host-specific details — no private IPs, service inventories,
    domains, or server paths. It's generic self-hosted software; deployment specifics live in the
    operator's own notes.

## Commands

Not yet real — T001–T003 create them. Written here so they land in the shape the rest of the
docs already assume.

```bash
npm run dev          # Next dev server on :3000
npm run lint
npm run typecheck
npm test
npm run build
npm run test:ci      # all four exactly as CI runs them, coverage included

npm run db:up        # start Postgres (waits for healthy) · db:down · db:logs
npm run db:reset     # destroy the volume and re-run initdb
npm run db:generate  # generate a migration from schema changes
npm run db:migrate   # apply migrations
npm run db:studio    # Drizzle Studio

npm run seed:invite  # mint a bootstrap invite code
npm run fx:refresh   # fetch today's rates now (same code path as the timer)
```

Use the `db:*` scripts, not raw `docker compose`. They pass `--project-directory .` so `.env`
resolves from the repo root — without it compose silently reads `infra/.env`.

**Never read `process.env` directly.** Import `config` from `src/server/config.ts`, which
validates everything once at boot and fails with a message naming what's wrong. Tooling that runs
outside Next (`drizzle.config.ts`) imports `config.schema.ts` instead, to avoid the `server-only`
guard.

**Integration tests need a database.** They run against `cuadre_test`, created by
`infra/postgres-init/` on a fresh volume, and are addressed by `DATABASE_URL_TEST`. They skip
locally when it's unset so unit tests still run without Docker — but fail in CI if it's missing,
because a silent skip there is indistinguishable from a pass.

## Working from the backlog

Tasks live in [backlog/tasks/](backlog/tasks/) as self-contained markdown files — each has
enough context to be picked up cold. See [backlog/README.md](backlog/README.md) for the
lifecycle and the task format.

**Never commit to `main`.** Branch as `<type>/<task-id>-<slug>`, open a PR, and let Santiago
review and merge. One task per branch.

When you finish a task, update its `status` frontmatter in the same commit as the code.

## Conventions

- Conventional commits (`feat:`, `fix:`, `chore:`, `docs:`). Reference the task id:
  `feat(splits): add percentage strategy [T032]`
- Zod validates every API input at the route boundary, before it reaches a service.
- Money crosses the wire as `{ amount: "350000", currency: "COP" }` — a **string** of minor units,
  because JSON numbers are doubles and `Number.MAX_SAFE_INTEGER` is reachable in COP.
- UI copy is Spanish-first via i18n keys. Never hardcode user-facing strings.
- Dates on an expense are **calendar dates** (`date`, no time, no zone). "The dinner on the 14th"
  is not an instant, and a trip crossing timezones must not shift an expense to another day.
