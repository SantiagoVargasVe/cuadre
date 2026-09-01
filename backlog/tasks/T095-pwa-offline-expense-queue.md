---
id: T095
title: Installable PWA with a safe offline create-expense queue
epic: E10-quality-of-life
status: todo
depends_on: [T034, T036, T060, T064]
size: L
---

## Context

Restaurant Wi-Fi is exactly when a group needs to record an expense. Offline support may make a
create eventually succeed, but it must not duplicate money, submit under the wrong account, cache
another group's ledger, or turn an old draft into a silently invalid expense. This task covers only
new expense creation; the server remains the source of truth for all resolved amounts and balances.

Read [architecture.md](../../docs/context/architecture.md),
[api-contract.md](../../docs/context/api-contract.md) § *Conventions* and § *Expenses*,
[security.md](../../docs/context/security.md), [data-model.md](../../docs/context/data-model.md)
§ *expenses*, [splitting.md](../../docs/context/splitting.md),
[testing.md](../../docs/context/testing.md), [backend/CLAUDE.md](../../docs/backend/CLAUDE.md),
[frontend/CLAUDE.md](../../docs/frontend/CLAUDE.md),
[design-system.md](../../docs/frontend/design-system.md),
[ADR-0001](../../docs/adr/0001-nextjs-fullstack-monolith.md),
[ADR-0003](../../docs/adr/0003-jwt-cookie-and-bearer.md), and
[ADR-0005](../../docs/adr/0005-expense-as-balanced-ledger-entry.md). Re-read T034: an offline
payload is intent only and must resolve through the same server write path when it is delivered.

## Acceptance criteria

- [ ] Make the web client installable with a standards-based web manifest, icons, and a service
      worker. The service worker caches only versioned static assets and a generic offline fallback;
      it must never cache authenticated HTML, `/api/**` responses, group names, member lists,
      balances, expense data, or request/response bodies. It never performs API writes or Background
      Sync on its own.
- [ ] Add a durable, versioned IndexedDB queue managed by the signed-in page client, not by the
      service worker. Each item contains a generated UUID idempotency key, the exact validated
      T034 create payload, its `groupId`, its owner `userId`, enqueue timestamp, retry state, and
      no auth token, email, balance, resolved split, or cached server response. Preserve an
      original calendar `date` exactly; do not replace it with flush time or reinterpret it across
      timezone/DST changes.
- [ ] Queue only after the existing expense form has passed client validation and the browser cannot
      obtain a response because it is offline, the request fails at transport level, or it receives
      a retryable `5xx`. A `400`, `401`, `403`, `404`, `409`, or `422` is never retried blindly:
      retain the payload as a visible "needs attention" draft with the safe error code, and require
      the user to edit/retry or explicitly discard it. A quota/storage failure is shown before the
      UI says the expense was saved.
- [ ] Extend only `POST /api/groups/:id/expenses` with a required UUID `Idempotency-Key` header.
      Persist a server-side idempotency record scoped to `(acting_user_id, key)`, containing a
      canonical hash of the parsed payload plus `group_id` and the created `expense_id`; uniqueness
      is enforced by PostgreSQL. The idempotency record and normal T034 expense/payer/split/revision
      transaction commit or roll back together.
- [ ] On a repeat with the same acting user, key, group, and canonical payload, first re-check
      current membership and then return the original serialized expense without another ledger
      write (`200` plus `Idempotency-Replayed: true`; the initial write remains `201`). Same key
      with a different group or canonical payload returns `409 IDEMPOTENCY_KEY_REUSED`. A removed
      or non-member caller always gets private `404`, even if an older attempt under that key
      succeeded. Idempotency records are retained indefinitely; expiring them would make a delayed
      local retry capable of duplicating money.
- [ ] The server canonicalizes/hashes the route-validated payload itself (including the route's
      group ID), never a client-provided hash. The key is treated as an opaque UUID, rate limiting
      and Origin checks remain in force, and logs/error details must not include payload content,
      titles, amounts, UUID keys, or an expense ID revealed before authorization. A normal online
      create also sends a fresh idempotency key, so retry behavior has one code path.
- [ ] A foreground queue flush runs only after the current page has freshly established the current
      session user and matches that `userId` to the queue item's owner. It sends the existing
      same-origin cookie request and its original idempotency key; it never stores a JWT and never
      lets a service worker replay a write after logout, session expiry, or account switch. Flush in
      FIFO enqueue order per owner, stop that owner's queue on an auth/membership failure, and use
      the server response to invalidate the group expense and balance queries.
- [ ] Queued payloads from another account are never listed, flushed, or rendered after an account
      switch. On explicit logout with queued items, show a Spanish resolution gate: sync while the
      session is still valid, discard, or cancel logout. Do not silently delete unsynced money.
      If the session has already expired, retain the owner-scoped queue but expose it only after that
      same user authenticates again; another user cannot access it through the app.
- [ ] The expense form clearly distinguishes server-confirmed, queued-offline, retrying, and
      needs-attention states; a queued item is not added optimistically to the authoritative feed
      or balances. Provide an accessible queue status surface with retry/edit/discard controls and
      Spanish i18n copy. Editing a failed draft creates a **new** idempotency key and retires the
      old queue item; never reuse a key for changed intent.
- [ ] No offline support is added for expense PATCH/DELETE, settlements, group settings, comments,
      images, auth, or any other mutation. The UI stays usable at 375px and the PWA must continue
      to function correctly when the service worker updates while queue records from an older schema
      exist: migrate compatible records, and quarantine an unknown record version rather than
      sending it blindly.
- [ ] Tests include real-Postgres concurrent requests with the same idempotency key (exactly one
      expense/revision/idempotency row), replay after a lost response, mismatched-key conflict,
      authorization re-check on replay, and transaction rollback leaving no idempotency record.
      Browser/client tests cover offline enqueue, FIFO replay, `5xx` retry, terminal validation and
      membership failures, timezone-invariant retained dates, account-switch isolation, logout
      resolution, no optimistic balance/feed mutation, and an API-cache test proving authenticated
      API data is not stored by the service worker.
- [ ] Update [data-model.md](../../docs/context/data-model.md),
      [api-contract.md](../../docs/context/api-contract.md),
      [security.md](../../docs/context/security.md),
      [architecture.md](../../docs/context/architecture.md), and
      [testing.md](../../docs/context/testing.md) with the idempotency, queue, cache, auth, and
      retention rules.

## Out of scope

- Receipt photos, offline media storage, or any change to **T091**
- Notifications, push permissions, background push, email, or any change to **T094**
- Any host-backup work, server-side backup of browser queues, backup credentials, or restore flow
- Offline edit/delete, settlements, comments, group/member changes, authentication, or a native app
- Caching private group/API data for offline read, token persistence, service-worker write replay,
  or an optimistic balance implementation

## Files likely touched

```
public/manifest.webmanifest
public/icons/
src/app/layout.tsx
src/app/providers.tsx
src/app/_pwa/register-service-worker.ts
src/app/_pwa/service-worker.ts
src/lib/offline-expenses/queue.ts
src/lib/offline-expenses/types.ts
src/lib/offline-expenses/flush.ts
src/server/db/schema.ts
src/server/db/migrations/00NN_expense_create_idempotency.sql
src/server/services/expenses.ts
src/app/api/groups/[id]/expenses/route.ts
src/lib/api/client.ts
src/app/(app)/g/[groupId]/_components/ExpenseForm.tsx
src/app/(app)/g/[groupId]/_components/OfflineExpenseQueue.tsx
src/app/_shell/UserMenu.tsx
src/lib/i18n/es.ts
docs/context/data-model.md
docs/context/api-contract.md
docs/context/security.md
docs/context/architecture.md
docs/context/testing.md
```
