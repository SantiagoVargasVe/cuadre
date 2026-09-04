# Cuadre

Group expense splitting for trips and shared activities. Add what you paid, say how it was
split, and the app works out who owes whom — then simplifies those debts into the fewest
payments that settle everyone up.

Built to be self-hosted with Docker behind a Cloudflare Tunnel — no inbound ports required.

## Why this exists

Six people on a trip. One covers the Airbnb, another the rental car, someone spots a friend for
dinner because their card got declined, and half of it happens in a currency nobody normally
uses. By day three the group chat is the ledger, and the ledger is wrong.

Cuadre keeps the ledger, in the currencies things were actually paid in, and turns it into a
short list of payments at the end.

## What it does

- **Groups** — a trip or a shared activity, with members, a title, and a description
- **Flexible splits** — equally, among a subset, by percentage, by exact amounts, by shares, or
  as a straight loan from one person to another
- **Multiple payers** — one expense can be covered by several people at once
- **Multi-currency** — COP (default), USD, EUR. Expenses stay in the currency they were paid in;
  a group can switch its display currency at a pinned rate, and switch back
- **Balances** — what each member paid, what they owe, and where they net out
- **Simplify debts** — collapse a tangle of IOUs into the fewest payments. Reversible: it's
  computed, never stored
- **Settle up** — record a payment and watch the balances clear

## Stack

Next.js 15 (App Router) · TypeScript · Tailwind v4 · [Base UI](https://base-ui.com) ·
TanStack Query · react-hook-form + Zod · Drizzle · PostgreSQL 17 · Vitest · Docker

## Getting started

Nothing to run yet — see *Status* below.

```bash
cp .env.example .env      # fill in the values — AUTH_SECRET needs 32+ chars
npm install
npm run db:up             # Postgres 17 in Docker
npm run dev
```

Open http://localhost:3000. Registration needs an invite code — seed one with
`npm run seed:invite`.

### Recovering an account without email

Outbound mail is optional ([ADR-0011](docs/adr/0011-outbound-email-via-smtp.md)). When `MAIL_*`
is unset, when a mail provider is failing, or when a member's address predates verification and
`/forgot-password` won't serve them, mint a recovery link from the host:

```bash
npm run reset-link -- someone@example.com
```

It prints a single-use `/reset-password/<token>` URL valid for 30 minutes and sends nothing —
deliver it to the person however you like. This is a supported path, not a workaround.

## Documentation

This repo is built to be worked on with AI agents, so the context is the primary artifact.

- **[CLAUDE.md](CLAUDE.md)** — start here. Guardrails and where to find everything.
- **[docs/context/](docs/context/)** — product, architecture, data model, splitting, currency,
  API contract, security, testing
- **[docs/context/splitting.md](docs/context/splitting.md)** — the money math: split strategies,
  remainder allocation, the balance engine, and the simplification algorithm. The heart of the app.
- **[docs/adr/](docs/adr/)** — why things are the way they are
- **[docs/roadmap.md](docs/roadmap.md)** — milestones, and what's deliberately post-MVP
- **[backlog/](backlog/)** — the work, one file per task

## Status

**Scaffold.** The docs, ADRs, roadmap and backlog are written. The only code committed ahead of
them is the theme — [`src/app/globals.css`](src/app/globals.css) and
[`src/app/fonts.ts`](src/app/fonts.ts) — because it's design input rather than application
logic, and T001 wires the app to it rather than inventing it.

The first task is [T001](backlog/tasks/T001-init-nextjs.md). See
[backlog/README.md](backlog/README.md) for the full task index.
