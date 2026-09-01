---
id: T092
title: Recurring expense schedules with exactly-once materialization
epic: E10-quality-of-life
status: todo
depends_on: [T034, T035, T036, T064, T073]
size: L
---

## Context

Longer trips and shared households repeatedly pay the same rent, subscription, or weekly grocery
bill. A recurrence must create ordinary, balanced ledger expenses; it must never become a second
balance system or silently change an already-recorded expense. This task adds server-owned
schedules and an external daily trigger, following the same no-in-process-scheduler rule as FX.

Read [product.md](../../docs/context/product.md), [architecture.md](../../docs/context/architecture.md)
§ *Scheduled work*, [data-model.md](../../docs/context/data-model.md) § *expenses* and § *Deletion
semantics*, [splitting.md](../../docs/context/splitting.md), [api-contract.md](../../docs/context/api-contract.md),
[security.md](../../docs/context/security.md), [testing.md](../../docs/context/testing.md),
[backend/CLAUDE.md](../../docs/backend/CLAUDE.md),
[frontend/CLAUDE.md](../../docs/frontend/CLAUDE.md) § *The expense form*, and
[ADR-0005](../../docs/adr/0005-expense-as-balanced-ledger-entry.md). Re-read T034 and T035: each
materialized occurrence uses the existing expense write path and its balanced-ledger transaction.

The schedule is a template for **future** occurrences, not an editable projection over the ledger.
Editing or deleting an occurrence follows T035 and affects that one expense only; restoring a
deleted expense remains out of scope. Editing a schedule changes only occurrences whose scheduled
calendar date has not yet materialized.

## Acceptance criteria

- [ ] Add a `recurring_expenses` table holding: its UUID; `group_id`; an active/paused state;
      `title`, positive integer-minor-unit `amount`, `currency`, and the full `paid_by` and split
      *intent* required by T034; `expense_date` anchor; `frequency` (`weekly` or `monthly`);
      IANA `time_zone`; `created_by`; timestamps; and pause reason. Do not store resolved balances
      or a rolling "next run" timestamp as truth. The schedule's inputs must be sufficient to call
      the normal expense resolver for a later occurrence.
- [ ] Add `recurring_expense_occurrences` with `recurring_expense_id`, `scheduled_for` (a calendar
      `date`), and `expense_id`, with a unique constraint on `(recurring_expense_id, scheduled_for)`
      and a unique `expense_id`. Insert its row and the ordinary expense/revision in **one database
      transaction**. This is the durable exactly-once boundary; neither an in-memory lock nor a
      job-run timestamp is acceptable.
- [ ] A schedule's timezone controls only which **local calendar date** is due. Use a validated IANA
      zone and `Intl.DateTimeFormat(..., { timeZone }).formatToParts()` (or an equivalently tested
      platform primitive) to derive today's `YYYY-MM-DD`; do not derive it from the server's local
      timezone, UTC date, or a JavaScript `Date` parsed from an expense date. Stored expense dates
      and `scheduled_for` remain calendar dates with no time or zone.
- [ ] Weekly schedules recur on the anchor's weekday. Monthly schedules recur on the anchor's day
      number; an anchor on the 29th, 30th, or 31st is **skipped** in months without that date (it
      does not drift to the last day). This rule, including leap years, is documented in the API
      contract and shown in the schedule form's Spanish helper text.
- [ ] The materializer is an authenticated, externally triggered `POST` endpoint plus an operator
      timer/unit modelled on T074; it is never `setInterval`, a request-time side effect, or a
      mutating `GET`. It is safe to run concurrently, repeatedly, late, or after downtime: every
      due date from the later of the anchor and the first unmaterialized date through the schedule
      timezone's today is attempted, and the uniqueness constraint makes a duplicate attempt a
      no-op. A delayed run creates the missed expense with its original `scheduled_for` date, not
      today's date.
- [ ] The trigger authenticates with a dedicated validated secret and constant-time comparison,
      fails closed with `404` when unset, is rate limited, and logs schedule/user IDs but never
      titles, amounts, request bodies, tokens, or member names. Add only the minimum deployment
      config and timer required to invoke this feature; document its operational contract without
      recording host-specific details.
- [ ] Materialization calls the same server-side resolver and balanced-expense assertion/deferrable
      trigger as T034. It generates a fresh occurrence expense ID before resolving so its
      apportionment is deterministic for that occurrence; the generated row has its normal
      `created` expense revision and identifies the schedule creator as `created_by`/`updated_by`.
      It never trusts client-resolved payer or split amounts.
- [ ] Before every materialization, verify that the group is not archived and that the schedule
      creator, every payer, and every split participant are current group members. If any check
      fails, atomically pause the schedule with a non-sensitive machine-readable reason and create
      no partial occurrence. Never silently drop, replace, or re-apportion a removed participant;
      a current member must explicitly repair and resume the schedule.
- [ ] A current group member may create, list, update, pause, resume, and delete a schedule; all
      service methods take `actingUserId` and verify current membership. Schedule resources addressed
      by schedule ID load their group first and return `404` to non-members and removed members.
      Archived groups reject schedule mutations and materialization. Deleting a schedule stops future
      occurrences but never deletes its existing expenses or occurrence records.
- [ ] Define and document JSON endpoints and Zod schemas for group-scoped schedule list/create and
      id-addressed update/pause/resume/delete. Money is the existing string-minor-unit wire shape;
      split intent uses the existing T034 schema; timezone and calendar-date validation happen at
      the route boundary. List/read responses expose schedule state and occurrence linkage but no
      email address or raw secrets.
- [ ] The schedule editor starts from the expense form's fast-path defaults (current member pays,
      all current members split equally) but keeps recurrence controls collapsed until requested.
      It uses Spanish i18n keys, accessible labels, 44px touch targets, and does not slow the
      ordinary one-off "title, amount, save" flow. Feed/detail UI identifies a generated occurrence
      and links to its schedule without changing the ordinary expense's amount, date, or history.
- [ ] Tests against real Postgres cover: concurrent duplicate triggers create one expense and one
      occurrence row; retrying after a commit is a no-op; a run delayed across several dates
      backfills each valid date exactly once; a DST boundary in at least two IANA zones does not
      shift the due calendar date; monthly 29/30/31 and leap-year behavior; a removed participant,
      removed creator, or archived group pauses without an expense; every generated expense and
      revision still balances; non-member and removed-member schedule access is `404`; and an edit
      to one generated expense neither changes its template nor future occurrence uniqueness.
- [ ] Update [data-model.md](../../docs/context/data-model.md),
      [api-contract.md](../../docs/context/api-contract.md),
      [architecture.md](../../docs/context/architecture.md),
      [security.md](../../docs/context/security.md), and [testing.md](../../docs/context/testing.md)
      with the final schema, trigger, timezone, authorization, and test contracts.

## Out of scope

- Receipt photos or any change to **T091**; notifications, email, push, or any change to **T094**
- Any host-backup design, backup timer, backup credential, restore flow, or documentation claiming
  the application owns backups
- Auto-detecting recurring expenses, importing bank transactions, payment rails, budgets, and
  recurrence for settlements
- Retroactively changing generated expenses when a schedule changes, or using a recurrence to
  bypass T034's balanced-ledger/revision semantics

## Files likely touched

```
src/server/db/schema.ts
src/server/db/migrations/00NN_recurring_expenses.sql
src/server/services/recurring-expenses.ts
src/server/recurring/materialize.ts
src/server/config.schema.ts
src/app/api/groups/[id]/recurring-expenses/route.ts
src/app/api/recurring-expenses/[id]/route.ts
src/app/api/admin/recurring-expenses/materialize/route.ts
src/lib/schemas/recurring-expenses.ts
src/app/(app)/g/[groupId]/_components/RecurringExpenseForm.tsx
src/app/(app)/g/[groupId]/_components/RecurringExpenseList.tsx
src/app/(app)/g/[groupId]/_components/ExpenseRow.tsx
src/lib/i18n/es.ts
infra/systemd/
docs/context/data-model.md
docs/context/api-contract.md
docs/context/architecture.md
docs/context/security.md
docs/context/testing.md
```
