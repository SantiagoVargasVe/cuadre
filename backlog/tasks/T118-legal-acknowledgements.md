---
id: T118
title: Host legal documents and record registration acknowledgements
epic: E14-legal-and-trust
status: todo
depends_on: [T010, T011, T014]
size: L
---

## Context

Cuadre needs public, self-hosted Terms of Service and Privacy Policy pages, and a new account must
explicitly acknowledge each one before it is created. A checked browser control is not the record:
the registration transaction must persist which version of each document the user acknowledged and
the server timestamp of that acknowledgement. This leaves an audit trail when either document is
revised without treating a mutable `users` boolean as historic proof.

The product owner must provide or approve the initial Spanish legal copy and the initial version
labels before implementation starts. Do not invent legal promises or claim regulatory compliance
from generic placeholder text. The documents must accurately describe Cuadre's actual data
handling, including its invite-only registration and no-third-party request-path policy.

Read [data-model.md](../../docs/context/data-model.md) § *users* and *Deletion semantics*,
[security.md](../../docs/context/security.md) § *Authentication*, *Input handling*, and *Privacy*,
[api-contract.md](../../docs/context/api-contract.md) § *Auth*,
[frontend/CLAUDE.md](../../docs/frontend/CLAUDE.md) § *Routes*, *i18n*, *Responsive*, and
*Accessibility*, [backend/CLAUDE.md](../../docs/backend/CLAUDE.md),
[design-system.md](../../docs/frontend/design-system.md), and
[testing.md](../../docs/context/testing.md).

## Acceptance criteria

- [ ] Publish public, self-hosted `/terms` and `/privacy` routes. They render without a session,
      have Spanish metadata, and visibly identify their respective initial version and effective
      date. Their approved Spanish copy lives in the repository (or another versioned,
      deployment-coupled source), not an operator-owned external URL or third-party embed
- [ ] Add a single source of truth for the two document identifiers and their current version
      labels. The page rendering and registration persistence consume that same source, so a
      document edit cannot silently display one version and record another
- [ ] Add a `legal_acceptances` relation rather than consent booleans on `users`. Each immutable
      record contains the user id, document identifier (`terms` or `privacy`), document version,
      server-generated `acknowledged_at` timestamp, and a source that distinguishes an explicit
      registration acknowledgement from the one-time legacy backfill. Enforce one record per
      `(user, document, version)` and retain older-version records when either document changes
- [ ] The migration backfills the two initial-version records for every account that exists when
      it runs. Its timestamps are the rollout/migration time and its source is `legacy_backfill`:
      this represents the deliberate product assumption for the existing production account, not
      a fabricated historic acknowledgement time. It must not overwrite or delete any later
      explicit acknowledgement
- [ ] Add separate, required Terms and Privacy controls to `/register`, each with an accessible
      label and an in-context link to its own public document. The form uses the existing Base UI
      Checkbox primitive, preserves the invite-code prefill/editability, and does not turn the two
      acknowledgements into one combined control. At 375px, the labels and links remain readable,
      independently tappable, and keyboard reachable
- [ ] Extend the shared registration schema and `POST /api/auth/register` payload with two
      required acknowledgement values. Client validation gives each unchecked control its own
      Spanish message and keeps submission unavailable until the complete form is valid; route
      validation independently rejects either missing/false value with the existing generic
      `400 VALIDATION_ERROR` body. The server never accepts client-supplied timestamps, document
      versions, or legacy-backfill source values
- [ ] A successful registration inserts both explicit acknowledgement records in the same database
      transaction as the user, invite consumption, and optional group membership. If validation,
      invite consumption, or either acknowledgement insert fails, no account, membership, consumed
      invite, or partial acknowledgement remains. Existing login, session-cookie, rate-limit, and
      invite-concurrency behaviour stays unchanged
- [ ] Document the new relation and retention semantics in `data-model.md`, the expanded register
      request in `api-contract.md`, and the truthful collection/retention posture in
      `security.md`. Do not add IP-address, user-agent, email, or client-time logging merely to
      support these acknowledgements
- [ ] Tests cover both public document routes, distinct accessible checkboxes and links, individual
      client-side validation errors, the complete submitted payload, and the disabled-to-enabled
      registration action. Real-Postgres route/service tests cover missing or false consent,
      successful creation of exactly two explicit records with server timestamps/current versions,
      atomic rollback, the legacy backfill fixture, and the existing single-use-invite race. Run
      `npm run test:ci`

## Out of scope

- Drafting unapproved legal copy, providing legal advice, or claiming any particular jurisdiction's
  regulatory compliance
- A consent-management banner, cookie tracking, analytics, marketing communications, or optional
  product-email preferences
- Requiring existing users to complete a new interactive flow; the deliberate one-time migration
  backfill covers the current production account
- Re-acceptance UI, account-history UI, withdrawal/deletion workflows, document localization beyond
  Spanish, or a third-party legal-document/consent service
- Changing invitation, login, session, password, membership, or rate-limit product behaviour other
  than the registration request's required acknowledgements

## Files likely touched

```
backlog/README.md
src/app/(legal)/terms/page.tsx
src/app/(legal)/privacy/page.tsx
src/app/(auth)/register/RegisterForm.tsx
src/app/(auth)/register/RegisterForm.test.tsx
src/app/api/auth/register/route.ts
src/app/api/auth/register/route.test.ts
src/lib/legal.ts
src/lib/i18n/es.ts
src/lib/schemas/auth.ts
src/server/db/schema.ts
src/server/db/migrations/0010_*.sql
src/server/services/auth.ts
src/server/services/auth.test.ts
docs/context/data-model.md
docs/context/api-contract.md
docs/context/security.md
```
