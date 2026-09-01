---
id: T080
title: Export a group's expenses as CSV
epic: E9-insights
status: todo
depends_on: [T036]
size: M
---

## Context

CSV is the escape hatch: a group must be able to take its own expense history elsewhere without
copying rows from a phone screen. It deliberately comes first in E9. This is an export of the live
expense ledger, not a balance report — it preserves each expense's entered currency and never
creates a combined cross-currency total.

Read [data-model.md](../../docs/context/data-model.md) § *Deletion semantics* and *Query rules*,
[api-contract.md](../../docs/context/api-contract.md),
[security.md](../../docs/context/security.md), and
[testing.md](../../docs/context/testing.md). Read
[frontend/CLAUDE.md](../../docs/frontend/CLAUDE.md) and
[design-system.md](../../docs/frontend/design-system.md) before adding the download control.

## Acceptance criteria

- [ ] `GET /api/groups/:id/expenses.csv` returns every live expense the requester may read, after
      membership is verified **inside the service**. Non-members and removed members get `404`;
      archived groups remain exportable because archive means read-only, not invisible
- [ ] The response is UTF-8 `text/csv; charset=utf-8` with `Content-Disposition: attachment` and a
      filename derived from the group title but safely sanitized. It is a download, never JSON
- [ ] The header is exactly `expense_id,date,title,amount_minor,currency,split_strategy,payers,splits,created_at,updated_at`.
      Dates use their stored ISO calendar/RFC-3339 representation;
      `amount_minor` and every nested amount stay digits-only strings, never floats or locale-formatted
      money. `payers` and `splits` are JSON arrays in one CSV cell, each entry carrying `userId`,
      `displayName`, and `amount`, so multiple payers and non-equal splits survive the export
- [ ] Serialize RFC 4180 CSV correctly (commas, quotes, CR/LF, and Unicode). Protect spreadsheet
      formula injection: any plain user-controlled text cell whose first non-whitespace character
      is `=`, `+`, `-`, or `@` is exported with a leading apostrophe. The `payers` and `splits`
      cells begin with `[` and remain parseable JSON with their original nested values
- [ ] Results are ordered `expense_date ASC, id ASC` so two exports of unchanged data have the same
      row order. Deleted expenses are excluded through `liveExpenses`; settlements are not expenses
      and never appear
- [ ] Use a bounded-query service, not a request per expense, payer, or split. Do not reuse the
      paginated feed endpoint by looping over cursors
- [ ] Multi-currency rows retain their individual currencies. The export has no converted column,
      display-currency setting, aggregate total, or implied cross-currency sum
- [ ] Add an i18n-backed, accessible "Exportar CSV" download control on the group expense view;
      it is available for an empty group too, whose CSV contains only the header. It must not block
      the common expense-entry flow
- [ ] Tests: membership and removed-member `404`; content type/disposition; exact header and stable
      ordering; commas/quotes/newlines and a formula-looking title; a formula-looking nested display
      name remains valid JSON; a multi-payer non-equal split; mixed currencies without a total;
      soft-deleted expense exclusion; and the header-only empty export
- [ ] `docs/context/api-contract.md` documents the route, response headers, CSV columns, and its
      authorization behavior

## Out of scope

- Categories. T090 adds the `category` column after its schema and fixed taxonomy exist; this task
  must not invent a tag field or emit a blank speculative column
- Chart data or image export (T081 onwards)
- Settlements, balances, display-currency conversion, and cross-group export
- Receipt files/photos, notifications, or any host-backup/storage work

## Files likely touched

```
src/app/api/groups/[id]/expenses.csv/route.ts
src/server/services/expenses-export.ts
src/app/(app)/g/[groupId]/_components/ExpenseExport.tsx
src/lib/i18n/es.ts
docs/context/api-contract.md
```
