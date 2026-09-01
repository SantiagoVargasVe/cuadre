---
id: T090
title: Categories on an expense — a fixed, app-provided set
epic: E10-quality-of-life
status: todo
depends_on: [T034, T035]
size: M
---

## Context

"What did we spend on food versus lodging" is the first question anyone asks after a trip, and
today the ledger cannot answer it. Categories are also the **prerequisite for the interesting half
of E9** ([roadmap.md](../../docs/roadmap.md)) — T081/T082 group by something, and without this they
can only group by member and by date.

**The taxonomy is a fixed, app-provided set — decided 2026-09-01, not free-form tags.** Free text
produces `comida`, `Comida` and `food` in one trip and pushes a normalisation job onto charts that
nobody will ever write. A curated list is one tap, has no cleanup story, and groups cleanly.

Read [data-model.md](../../docs/context/data-model.md),
[api-contract.md](../../docs/context/api-contract.md) § *Expenses*,
[testing.md](../../docs/context/testing.md), and
[design-system.md](../../docs/frontend/design-system.md) plus
[frontend/CLAUDE.md](../../docs/frontend/CLAUDE.md) § *The expense form* before the UI half.

## Acceptance criteria

- [ ] Migration adds an `expense_categories` lookup table — `key` (text, pk) and `sort_order`
      (smallint) — seeded in the migration with exactly:
      `comida, alojamiento, transporte, mercado, actividades, otro`.
      It mirrors how `currencies` is seeded (a lookup table, **not** a `pgEnum`) so a seventh
      category is an insert rather than an enum alter
- [ ] **No user-facing label is stored in the database.** The table holds keys; the Spanish labels
      live in `src/lib/i18n/es.ts` under `categories.*`, like every other string in the app
- [ ] `expenses.category_key` is a **nullable** FK to `expense_categories.key`. Nullable is
      deliberate: it distinguishes "nobody categorised this" from an explicit `otro`, and every
      expense that predates this task is honestly the former. No backfill
- [ ] The category round-trips through the whole expense lifecycle: `POST` accepts it, `PATCH`
      replaces it (including clearing it back to `null`), it appears in the `expense_revisions`
      snapshot, and it comes back on the list and detail reads
- [ ] Zod validates the key at the route boundary against the known set — an unknown key is `422`,
      not a silent `null`
- [ ] **The expense form's common case must not get slower.** The picker is optional, defaults to
      no category, and never blocks save. A horizontal row of chips in the already-open form is
      fine; a required step, a modal, or anything that adds a tap to "title, amount, save" is not.
      Re-read frontend/CLAUDE.md § *The expense form* — fifteen seconds is a hard requirement
- [ ] The feed row shows the category compactly when one is set, and shows nothing when it isn't.
      **Not colour alone** — a label or an icon plus a text alternative, per design-system.md
- [ ] The CSV export (T080) gains a `category` column carrying the **key**, not the Spanish label,
      so the file stays stable across a locale change. Empty when `null`
- [ ] Tests: the FK rejects an unknown key; `POST`/`PATCH` round-trip including clearing to `null`;
      the revision snapshot records a category change; an uncategorised expense stays valid; the
      form still submits with no category touched
- [ ] `docs/context/data-model.md` and `docs/context/api-contract.md` document the column

## Out of scope

- **Free-form tags, per-group custom categories, and a category editor.** All three were considered
  and rejected on 2026-09-01. Re-opening any of them needs an ADR, not a follow-up task
- Per-category budgets or limits
- The charts themselves (T081/T082) — this task only makes them possible
- Auto-categorisation by title. Tempting, wrong, and a research project
- Re-categorising in bulk from the feed

## Files likely touched

```
src/server/db/schema.ts
src/server/db/migrations/00NN_expense_categories.sql
src/server/services/expenses.ts
src/lib/schemas/expenses.ts
src/lib/categories.ts
src/app/(app)/g/[groupId]/_components/ExpenseForm.tsx
src/app/(app)/g/[groupId]/_components/CategoryPicker.tsx
src/app/(app)/g/[groupId]/_components/ExpenseRow.tsx
src/lib/i18n/es.ts
docs/context/data-model.md
docs/context/api-contract.md
```
