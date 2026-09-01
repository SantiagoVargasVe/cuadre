---
id: T093
title: Member-only, revisioned comments on an expense
epic: E10-quality-of-life
status: todo
depends_on: [T034, T035, T036, T063]
size: L
---

## Context

The discussion about an amount belongs next to the expense, not in a private WhatsApp thread that
later members cannot reconstruct. Comments are group data as sensitive as the ledger: access is
limited to current members, and a member must not be able to silently rewrite somebody else's
words. They are a separate append-only discussion history, not a field in `expenses` and not an
expense revision.

Read [product.md](../../docs/context/product.md), [data-model.md](../../docs/context/data-model.md)
§ *expenses*, § *expense_revisions*, and § *Deletion semantics*,
[api-contract.md](../../docs/context/api-contract.md), [security.md](../../docs/context/security.md),
[testing.md](../../docs/context/testing.md), [backend/CLAUDE.md](../../docs/backend/CLAUDE.md),
[frontend/CLAUDE.md](../../docs/frontend/CLAUDE.md),
[design-system.md](../../docs/frontend/design-system.md), and
[ADR-0005](../../docs/adr/0005-expense-as-balanced-ledger-entry.md). T035's history promise is
the model: a comment change must be attributable and must not alter what the expense ledger says.

## Acceptance criteria

- [ ] Add `expense_comments`: UUID, `expense_id`, denormalized `group_id`, `author_id`, body,
      `version` (starting at 1), `created_at`, `updated_at`, and nullable `deleted_at`. Add an
      index for live comments by `(expense_id, created_at, id)` and a composite FK from
      `(group_id, author_id)` to `group_members`; the service still checks current membership,
      because the historical member row survives removal.
- [ ] Add `expense_comment_revisions`: UUID, comment ID, version, action
      (`created | updated | deleted`), complete body snapshot, `changed_by`, and UTC timestamp,
      unique on `(comment_id, version)`. Create the comment/update/soft-delete and its revision in
      one transaction. Comment revisions are immutable audit history; they never modify
      `expenses.version`, `updated_by`, `expense_revisions`, payer/split rows, or balances.
- [ ] All current group members may read and create comments on a live expense in a non-archived
      group. Only the comment's author may edit or delete it; group owners have no impersonation
      or moderation override in this task. A deleted comment remains as a chronological tombstone
      with its author and timestamps but never returns the deleted body or a revision body to the
      normal discussion API.
- [ ] Edit and delete require the caller's current membership **and** authorship inside the service.
      Id-addressed comment routes load the comment, then its expense/group, and apply membership
      before returning data or deciding authorship. A non-member, removed member, unknown expense,
      deleted expense, or deleted comment receives the standard private `404`; an active member
      editing another author's comment receives `403 COMMENT_AUTHOR_REQUIRED`.
- [ ] Creating, editing, or deleting comments on an archived group is refused. Soft-deleting an
      expense makes its comments and revisions inaccessible through all normal APIs but preserves
      the rows for forensic/history integrity; no comment operation restores an expense.
- [ ] Provide `GET`/`POST /api/expenses/:id/comments` and id-addressed `PATCH`/`DELETE`
      `/api/expense-comments/:id`. The list is cursor-paginated, ordered `created_at ASC, id ASC`
      so a conversation reads oldest first without unstable ties. POST returns `201`; PATCH returns
      the new current representation; DELETE returns `204`. The expense detail can request its
      first page without N+1 author lookups.
- [ ] Zod accepts a plain-text body of 1–2,000 Unicode characters after trimming only the
      submission's leading/trailing whitespace; empty/oversize bodies are `400 VALIDATION_ERROR`.
      Store and render the body as text, never HTML or Markdown, and never use
      `dangerouslySetInnerHTML`. Comments have no attachments, mentions, link previews, email
      addresses, or user-supplied URL fetches.
- [ ] PATCH includes the currently displayed `version`; a stale version returns `409
      COMMENT_VERSION_CONFLICT` with the latest safe comment representation, never a silent
      last-write-wins overwrite. The client refreshes/renders that current comment and asks the
      author to explicitly retry their edit. A delete also requires the current version so an author
      cannot unknowingly delete a newer edit from another browser session.
- [ ] Responses expose only comment IDs, safe body/tombstone state, timestamps, version, and
      author `{ userId, displayName, avatar }`; never author email, revision bodies, passwords,
      tokens, or group membership beyond what an existing member view already returns. Errors and
      logs likewise omit comment body and money amounts.
- [ ] Add a compact comments section to the existing expense detail sheet: chronological entries,
      visible edited/deleted state, a member-only composer, and edit/delete controls only on the
      current user's own active comments. It uses Spanish i18n keys, an accessible labeled textarea
      and actions, safe text rendering, and query invalidation/refetch after mutations. Do not
      optimistically display a comment as authoritative before the server response.
- [ ] Tests against real Postgres cover: current-member read/create; non-member and removed-member
      `404` on collection and id routes; author-only edit/delete and `403` for another current
      member; archive/deleted-expense refusal; exact revision sequence and retained snapshot after
      soft delete; stale edit/delete conflict; cursor ordering with same-timestamp ties; no N+1
      author query across a page; and responses never contain an email or deleted/revision body.
      Frontend tests cover text escaping, own-controls-only visibility, the conflict recovery state,
      and Spanish accessible labels.
- [ ] Update [data-model.md](../../docs/context/data-model.md),
      [api-contract.md](../../docs/context/api-contract.md),
      [security.md](../../docs/context/security.md), and [testing.md](../../docs/context/testing.md)
      with the data retention, privacy, authorization, concurrency, and test contracts.

## Out of scope

- Receipt photos, image/file attachments, or any change to **T091**
- Notifications, email, push, `@mentions`, unread counts, or any change to **T094**
- Any host-backup work; comment history is an application audit trail, not a backup product
- Editing another member's comment, owner moderation, reactions, threads, Markdown, link previews,
  full-text search, or exposing comment-revision history in the normal member UI
- Changing an expense's amount, split, revision, balance, or authorization model because it has a
  comment

## Files likely touched

```
src/server/db/schema.ts
src/server/db/migrations/00NN_expense_comments.sql
src/server/services/expense-comments.ts
src/app/api/expenses/[id]/comments/route.ts
src/app/api/expense-comments/[id]/route.ts
src/lib/schemas/expense-comments.ts
src/app/(app)/g/[groupId]/_components/ExpenseComments.tsx
src/app/(app)/g/[groupId]/_components/ExpenseCommentRow.tsx
src/app/(app)/g/[groupId]/_components/ExpenseCommentForm.tsx
src/app/(app)/g/[groupId]/_components/ExpenseDetail.tsx
src/lib/i18n/es.ts
docs/context/data-model.md
docs/context/api-contract.md
docs/context/security.md
docs/context/testing.md
```
