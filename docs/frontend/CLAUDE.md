# Frontend Context

Scope: `src/app/` (routes, components, client state) and `src/lib/` (money formatting, i18n).

**Read [design-system.md](design-system.md) before writing any component.** It covers Base UI,
the design tokens, the 100-line limit, composition patterns, forms, and the TanStack Query setup.
This file covers app structure and product behaviour; that one covers how code is written.

**Read [splitting.md](../context/splitting.md) before touching the expense form.** The split
editor is the only screen in this app where the UI has to understand the domain model rather than
just render it.

You probably don't need `docs/backend/`. If you're changing an endpoint's shape, read
[api-contract.md](../context/api-contract.md) instead of the backend conventions.

## Stack

| | |
|---|---|
| Components | **Base UI** (`@base-ui/react`) — unstyled primitives, we style with Tailwind |
| Styling | Tailwind v4, tokens in `src/app/globals.css` |
| Forms | `react-hook-form` + `@hookform/resolvers/zod` |
| Data | TanStack Query over a single `apiFetch` base client |
| Tests | Vitest + React Testing Library |

**Not shadcn.** The tokens may come from a shadcn generator, but the components are Base UI.
Don't run `npx shadcn add` — it pulls in Radix and duplicates primitives we already have.

## The hard rule

**Never import Drizzle, the DB client, or anything under `src/server/`.** Components call Route
Handlers; Route Handlers call services. Reaching past that boundary is what makes FE and BE
context inseparable, which defeats the point of this setup.

`src/lib/money/` is the one shared module — it's pure, it's imported by both sides, and that's
intentional. The client formats and previews with the *same* functions the server resolves with,
so a live split preview can never disagree with what gets saved.

## Routes

| Route | What it is |
|---|---|
| `/login`, `/register` | Auth. Register requires an invite code — prefilled from `?code=`. |
| `/join/[code]` | Invite landing. **Works logged out.** |
| `/groups` | Your groups, each with your net position. |
| `/g/[groupId]` | The group. Three tabs: **Gastos · Balances · Ajustes**. |

`/` redirects: logged in → `/groups`, otherwise → `/login`.

`/join/[code]` is the entry point for every new user. Logged out it shows "Ana te invitó a
*Cartagena 2026*" and a register form; logged in it shows a join button. Both land on the group.
It must render before authentication, which is why the invite lookup endpoint is public.

Nothing in this app needs to render as a link preview — unlike the sibling wishlist repo, OG tags
are not an architectural constraint here. Server-render for latency, not for crawlers.

## Server vs client components

Default to **Server Components**. Reach for `"use client"` for actual interactivity: the expense
form, the split editor, the simplify toggle, optimistic settlement recording.

The group feed and the balances view render on the server. They're read-heavy, they're the first
paint on a phone over mobile data, and neither needs interactivity to be useful.

## Data loading

- `/groups` renders from `GET /api/groups`
- `/g/[groupId]` renders from `GET /api/groups/:id` plus the tab's own endpoint
- Balances come from `GET /api/groups/:id/balances` — **never** computed client-side from the
  expense list

That last one matters. `src/lib/money/` is shared so the client can *preview* a split before
saving, not so it can derive balances independently. Two implementations of the same arithmetic
that can disagree is precisely the bug this app exists to prevent — the server's answer is the
answer.

Don't fan out into per-expense requests. The feed is one paginated call.

## The expense form — the screen that matters

This is the flow that decides whether the app gets used. Someone standing at a restaurant table
must be able to add an expense in under fifteen seconds.

**The common case must cost nothing.** Title, amount, save. Everything else is pre-filled:

- Currency → the group's `defaultCurrency`
- Date → today
- Paid by → you, the full amount
- Split → every member, equally

The flexible machinery is real but **collapsed by default**. "Pagado por: tú" and "Dividido:
entre todos" are two lines of text that open editors when tapped. They are not two always-open
pickers.

### The split editor

One component per strategy, one shared shell. Each strategy owns its inputs and its validation;
the shell owns the live total and the save gate.

| Strategy | Input |
|---|---|
| `equal` / `equal_subset` | Member checkboxes. All checked = `equal`. |
| `shares` | A stepper per member. |
| `percentage` | A percent field per member. **Held as basis points**, integers. |
| `exact` | A money field per member. |
| `loan` | Pick one beneficiary. |

Non-negotiable behaviours:

- **A running remainder is always visible.** "Faltan $ 4.200" or "Sobran $ 1.100", live, using the
  shared money math. Not a validation error that appears on submit.
- **Save is disabled until the split balances exactly.** The API rejects it anyway; the point is
  that the user never gets that far.
- **Show the resolved per-member amounts, always**, including for `equal`. Someone splitting
  `100.000` three ways should see `33.333 / 33.334 / 33.333` before saving, not discover the
  stray peso later. Use the shared apportionment so the preview is byte-identical to what the
  server will store.
- Switching strategies **keeps the member selection** and re-derives amounts. Losing a
  seven-person selection because someone tapped "percentage" is unforgivable.

## Balances and the simplify toggle

Both tabs render the same data two ways.

- **Simplify off** — pairwise debts, mirroring what happened.
- **Simplify on** — the reduced payment plan.

Toggling is a `PATCH` on the group and re-renders. It is not a client-side transform, and there is
no local "simplified" state to get out of sync.

**A simplified edge must be explainable.** When simplify is on, tapping a payment shows the raw
debts it replaced — "pagas a Ana $ 40.000; reemplaza lo que le debías a Beto y lo que Beto le
debía a Ana." Without this, the plan looks arbitrary and people stop trusting it. The API returns
`explains[]` for exactly this.

Never show a negative amount as a payment direction. "Ana te debe $ 20.000" and "le debes a Ana
$ 20.000" are different sentences, not the same number with a sign.

## Multi-currency display

When a group has no display currency, balances arrive as **one block per currency**. Render them
as separate blocks with their own headings. **Never sum across them**, never show a combined
total, and don't let a layout imply one.

When a display currency is set, every converted amount is labelled, and the pin's date and source
are reachable in one tap. A number that quietly changed currency destroys trust faster than a
wrong number does.

The currency switcher lives in **Ajustes**, not in the header. It re-pins rates and affects every
member's view; it is not a personal view preference and must not feel like one.

## Money

**Never call `Intl` directly.** Use the shared formatter in `src/lib/money/format.ts`. Two
verified reasons it exists:

- `Intl.NumberFormat('es-CO', { currency: 'COP' })` renders `$ 150.000,00`. COP needs
  `maximumFractionDigits: 0` explicitly.
- `EUR` under `es-CO` renders `EUR 45,00`, not `€45,00`.

Money **inputs** take major units with locale thousands separators (`150.000`) and convert to
minor units on submit. The `bigint` boundary is the form's `onSubmit`, and nothing downstream of
it sees a `Number`.

## i18n

**Spanish-first.** No hardcoded user-facing strings — everything through i18n keys from day one,
even with one locale. Retrofitting is miserable.

Money and dates go through the shared formatters, not through inline template strings, or
locale-switching later will miss half the app.

## Responsive

Mobile-first. Most expenses get added on a phone, standing up, one-handed, on bad wifi. Verify at
375px, 768px, 1280px. Touch targets ≥ 44px. Modals become full-screen sheets on mobile. The
amount field gets `inputMode="decimal"` so phones open the right keyboard.

## Accessibility

Base UI handles focus trapping, escape-to-close, and ARIA wiring — don't reimplement it, don't
fight it.

What's still on you: every amount needs an accessible label naming *whose* it is ("Ana debe
$ 20.000", not a bare number in a row), and debtor/creditor state must never be signalled by
colour alone — red and green are the two colours most likely to be indistinguishable to a user,
and this is an app about who owes money.

## Tests

Vitest + React Testing Library, same commit as the code. Priorities in
[testing.md](../context/testing.md). Short version: the split editor's payload per strategy, the
live remainder, money formatting, optimistic rollback, and owner-only controls being absent rather
than disabled.
