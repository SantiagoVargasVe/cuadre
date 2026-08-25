---
id: T062
title: /groups — your groups and your net position
epic: E7-frontend
status: todo
depends_on: [T060, T061, T025]
size: S
---

## Context

The app's home screen. Its one subtlety is that a net position is per currency, and the layout
must not imply that two currencies can be added together.

Read [frontend/CLAUDE.md](../../docs/frontend/CLAUDE.md) § *Multi-currency display*.

## Acceptance criteria

- [ ] Server-rendered list from `GET /api/groups`
- [ ] Each card: title, member count, and **your net position per currency**
- [ ] **Never sum across currencies**, never show a combined total, and don't let the layout imply
      one. Two currencies are two lines
- [ ] Credit/debit state carries a **sign or a word alongside the colour**, never colour alone
- [ ] Empty state offers creating a group and explains that joining happens through an invite link
- [ ] Archived groups are visually separated, not silently dropped
- [ ] Create-group flow: title, description, default currency
- [ ] Verified at 375px
- [ ] Tests: a member with COP and USD positions renders two lines and no total; the empty state
      renders; creating a group navigates to it

## Out of scope

Group detail (T063). Invites UI (T068).

## Files likely touched

```
src/app/(app)/groups/page.tsx
src/app/(app)/groups/_components/*.tsx
```
