# Design System

**Mandatory reading before writing any component.**

## Component library: Base UI

[Base UI](https://base-ui.com) (`@base-ui-components/react`) — unstyled, accessible primitives.
We own every pixel; the library owns focus management, keyboard interaction, and ARIA.

**Not shadcn, not Radix directly.** If a snippet you're adapting imports `@radix-ui/*`, port it to
the Base UI equivalent rather than adding a second primitive library.

Primitives this app actually needs: `Dialog` (expense form, settle-up), `Popover` (member picker),
`Select` (currency), `Checkbox`, `RadioGroup` (split strategy), `Switch` (simplify), `Tabs` (group
tabs), `Toast`, `Tooltip`, `NumberField` (shares stepper).

Anything not on that list, ask whether the screen needs it before installing it.

## Tokens

The theme is committed at [`src/app/globals.css`](../../src/app/globals.css) — a Tailwind v4
`@theme inline` block over OKLCH custom properties, with dark mode on the `.dark` class variant.
**Never a hardcoded colour in a component.** Light and dark are both first-class; dark is not an
afterthought, because half of expense-adding happens at night in a restaurant.

Violet primary (`#6C5CE7`), blue secondary, olive accent in light / cornflower in dark, and a
red destructive.

### Money semantics

Three tokens this app adds beyond the usual set:

| Token | Meaning | Light | Dark |
|---|---|---|---|
| `--credit` | You are owed. Positive net. | `#1F7E3F` | `#6FD488` |
| `--debit` | You owe. Negative net. | `#C72D30` | `#F87B73` |
| `--settled` | Net zero — the resting state, deliberately calm. | `#6E6E6E` | `#A3A3A3` |

Available as `text-credit`, `bg-debit`, `border-settled`, and so on.

**Do not use `--destructive` for a debit amount.** It measures 3.57:1 on the light background and
3.76:1 on a card — it fails AA as body text, and a debit is body text on the busiest screen in the
app. `--destructive` is for destructive *actions* (delete expense, remove member), where it sits on
a button large enough to qualify for the 3:1 threshold. The `--debit` token exists precisely
because reaching for the red you already have is the obvious wrong move here.

All three clear AA (≥ 4.5:1) against **both** `--background` and `--card`, measured, in both themes.

### Contrast — measured, not assumed

Everything below was computed from the OKLCH values. Design against it rather than re-deriving it.

**Safe for small text**

| Pair | Light | Dark |
|---|---|---|
| `foreground` on `background` | 12.00 | 13.40 |
| `card-foreground` on `card` | 12.63 | 10.01 |
| `primary-foreground` on `primary` | 4.86 | 4.86 |
| `secondary-foreground` on `secondary` | 7.31 | 10.28 |
| `muted-foreground` on `background` | 4.84 | 6.69 |
| `accent-foreground` on `accent` | 4.78 *(corrected)* | 5.68 *(corrected)* |
| `accent` as text on `background` | 4.54 | 5.68 |
| `credit` / `debit` / `settled` on `background` or `card` | ≥ 4.82 | ≥ 4.84 |

**Not safe for small text — these are the traps**

| Pair | Light | Dark | What to do |
|---|---|---|---|
| `muted-foreground` on `muted` | **2.93** | **3.86** | Never. Use `foreground` on `muted` (7.25 / 7.73). |
| `destructive` as text | **3.57** | **4.49** | Use `--debit` for amounts; keep `--destructive` for action surfaces. |
| `border` on `background` | 1.41 | 1.73 | Expected — decorative. Any border that *conveys* state needs another cue. |

**Two corrections were applied to the supplied theme**, both marked `[CUADRE]` in `globals.css`.

*Dark `--accent-foreground`* was near-white on a cornflower-blue accent: **2.36:1**, unreadable
rather than merely tight. It now uses the dark background tone on the same accent — **5.68:1**,
leaving the accent colour itself untouched.

*Light `--accent`* (`#8B9467`) carried white text at only **3.22:1**. Its OKLCH lightness moved
`0.6475 → 0.5500`; **hue and chroma are unchanged**, so it is the same olive one step deeper
(`#6E774B`). That fixes it in both directions at once — white on accent is now **4.78**, and the
accent used *as text* on the background goes from 3.05 to **4.54**, which it needed anyway.
`--sidebar-accent` tracks it.

### Why colour alone genuinely cannot carry credit vs. debit

**Every credit/debit amount carries a sign, a word, or an icon alongside the colour.** This is not
boilerplate accessibility advice here, and the numbers say why: `--credit` and `--debit` differ in
OKLCH lightness by **0.02** in light mode, and their contrast *against each other* is **1.08:1**.

To a user with deuteranopia — the most common colour-vision deficiency — those two amounts are
very close to identical. Not "harder to tell apart": the same. An app whose entire output is who
owes whom cannot encode that in hue alone.

Raising the lightness gap would fix the simulation and wreck the design, making one of the two
look washed out next to the other. The sign and the word are the fix.

### Fonts

Montserrat (sans) and Source Code Pro (mono), loaded via `next/font` in
[`src/app/fonts.ts`](../../src/app/fonts.ts) — self-hosted at build time, so no runtime request to
a third party and no layout shift.

**Montserrat ships the `tnum` OpenType feature** — verified against the actual font binary, so
`font-variant-numeric: tabular-nums` on money columns is real and not a silent no-op. That
requirement would have failed quietly with a face that lacked it, and a balances list with
shifting digit widths is exactly the kind of thing nobody files a bug about.

**Playfair Display is deliberately not loaded.** `--font-serif` is defined for completeness, but
this app has no editorial surface and an unused ~120 KB face is pure cost. Using `font-serif`
today yields the system serif — if a real use appears, add it to `fonts.ts` first.

Source Code Pro has no `tnum`, which is moot: it's monospace, so its digits are already
fixed-width.

### Dark mode

`.dark` on an ancestor, via `@custom-variant dark (&:is(.dark *))`. It is class-driven, not
`prefers-color-scheme`, so something has to set that class — use `next-themes` with
`attribute="class"` and `defaultTheme="system"`, plus `suppressHydrationWarning` on `<html>`, or
the first paint flashes the wrong theme.

`color-scheme` is declared in both blocks so native scrollbars and form controls follow.

## Component rules

### Maximum 100 lines per file

Enforced by ESLint `max-lines`. One component per file. The limit is a forcing function for
composition, not a style preference — when a file approaches it, the answer is almost always that
two things are living in one component.

The split editor is the natural test of this. It is *not* one 400-line component with a
`switch`. It's a shell plus one small component per strategy, each with its own file and test.

### Composability over configuration

A component with nine boolean props is two components wearing a trenchcoat.

```tsx
// no
<MemberRow member={m} showAmount showAvatar editable variant="compact" isDebtor />

// yes
<MemberRow member={m}>
  <MemberRow.Avatar />
  <MemberRow.Name />
  <MemberRow.Amount value={amount} />
</MemberRow>
```

### `cn()`

One `cn()` helper (`clsx` + `tailwind-merge`) for conditional classes. No inline `style` except
for genuinely dynamic values (a chart bar's width), and none of those exist before E9.

## Money display

**One component renders money. Never format inline, never call `Intl` in a component.**

```tsx
<Money value={{ amount: 15000000n, currency: "COP" }} />   // $ 150.000
<Money value={net} signed />                                // + $ 20.000 / − $ 20.000
```

Backed by `src/lib/money/format.ts`, which exists to absorb two verified quirks:

- `Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' })` gives `$ 150.000,00`.
  CLDR assigns COP two fraction digits; Colombians expect none. Pass `maximumFractionDigits: 0`.
- `EUR` under `es-CO` gives `EUR 45,00`, not `€45,00`.

**Amounts are tabular.** Use `font-variant-numeric: tabular-nums` everywhere money appears in a
column, or a balances list becomes unreadable as digits shift.

**A converted amount is always marked.** When a group has a display currency, `<Money>` shows the
converted value with an affordance to the original and the pin date. Unlabelled converted money is
a trust bug.

## Forms — react-hook-form + Zod

One schema per form, colocated, shared with the API's schema where the shapes match. Validation
messages come from i18n keys.

`<MoneyField>` is the shared input: locale thousands separators while typing (`150.000`),
`inputMode="decimal"`, and a `bigint` of minor units out of `onSubmit`. **The conversion happens
once, at the form boundary.** Nothing downstream ever sees a `Number`, and no component does its
own parsing.

Submit buttons are disabled while the form is invalid or in flight, and every destructive action
(delete expense, remove member, archive group) confirms through a `Dialog` naming what will happen.

## Data — TanStack Query

One `apiFetch` base client that handles the error envelope from
[api-contract.md](../context/api-contract.md) and throws typed errors. Query keys are arrays
scoped by group: `["group", groupId, "expenses"]`.

**Adding, editing, or deleting an expense or settlement invalidates the group's balances key.**
Every time. A stale balance after an edit is the most damaging kind of wrong number this app can
show, because it looks authoritative.

Optimistic updates are for toggles and settlement recording. **Never optimistic for creating or
editing an expense** — the server resolves the split, and guessing at its answer is how the client
and server end up disagreeing about who owes what.

## Layout

Mobile-first. A single content column with a max width; the group feed is a list, not a grid.

The **add-expense affordance is a fixed bottom-right FAB on mobile**, reachable one-handed. It is
the single most-used control in the app and it does not scroll away.

Dialogs become full-screen sheets below `768px`. The expense form is the one that matters — on a
phone it is a full sheet with the amount field focused on open.

## Hooks

Shared hooks live in `src/lib/hooks/`, one per file, each with a test. Anything used by more than
one component moves there rather than being duplicated or lifted into a shared parent.

## Tests

Query by role and label, not test ids. Test what a user can observe.

**Don't test Base UI itself** — focus trapping and escape-to-close are the library's problem.
Do test: the split editor's output payload per strategy, the live remainder, `<Money>` formatting
per currency, and that owner-only controls are *absent* for non-owners rather than disabled.
