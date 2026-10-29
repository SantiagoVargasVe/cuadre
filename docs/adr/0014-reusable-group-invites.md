# ADR-0014 — Reusable group invites with a fixed 24-hour lifetime

**Status:** Accepted · 2026-10-29 · supersedes ADR-0002's single-use rule for newly minted group invites

## Context

An organizer shares one link in a friends' chat. Some recipients already have accounts; others
must register. Consuming that link for the first person prevents the rest from joining.

## Decision

Keep the unified `invite_codes` table and transactional register-and-join flow. Newly minted
group invites have `reusable = true` and an expiry exactly 24 hours after server-side creation.
The creation endpoint accepts an empty object; clients cannot choose a different deadline.

Validation stays inside the caller's transaction. A conditional update locks the invite row and
checks expiry, unconsumed state and an unarchived group. Reusable rows keep `consumed_at` and
`consumed_by` null; legacy rows still atomically record the one consumer. Check expiry again
after acquiring the row lock so waiting cannot admit a user past the deadline. Membership's
composite key prevents duplicates; removed members return as plain members, never owners.

The migration defaults `reusable` to false. Existing links keep their previous single-use
semantics; spent or expired links never become valid again. A database check requires reusable
invites to carry a group and expiry and forbids recording a single consumer on them.

## Consequences

- One live group link allows multiple registrations and existing-user joins. Each new account,
  its legal acknowledgements and membership still commit together or all roll back.
- Plain registration/bootstrap invites remain single-use. Registration is still invite-only.
- Anyone holding the shared link can register and join that group until the fixed deadline.
  The UI explains reuse and expiry; public lookup adds only expiry metadata to its existing
  group-title/inviter/validity response. Existing rate limits and Origin checks remain.
- No invite revocation screen, use-count cap, configurable lifetime or delivery service is added.
- Expiry is checked on lookup and every write; no scheduled cleanup job is needed.
