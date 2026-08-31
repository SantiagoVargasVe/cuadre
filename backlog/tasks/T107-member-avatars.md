---
id: T107
title: Deterministic generated avatars for members
epic: E12-first-use
status: todo
depends_on: []
size: M
---

## Context

Every list in this app is a column of names — members, payers, splits, balance rows, payment plan
edges, settlement history. On a phone, scanning "who is this row about" is slower than it should
be. Generated avatars (the GitHub identicon idea) give each member a stable shape and colour to
recognise, with no uploads and no file storage.

**Two constraints that decide the design, not preferences:**

- **The seed must be `userId`.** Email addresses are never returned by any endpoint except
  `GET /api/auth/me` for the caller's own record ([security.md](../../docs/context/security.md)
  § *Privacy*) — the client physically cannot have a co-member's email, so an email-seeded avatar
  is impossible without leaking one. `displayName` is available but wrong as a seed: renaming
  yourself would silently change your avatar everywhere, including on historical rows.
- **It must render locally.** DiceBear's HTTP API and any other remote avatar service are out:
  architecture.md states the app's only outbound dependency is one FX call a day, and a
  per-render request to a third party would put that third party in the request path of every
  page — a privacy change, not just a dependency. Use a library that generates SVG in-process
  (`boring-avatars` is a pure-SVG React component; `@dicebear/core` plus a collection also runs
  offline). Whichever is chosen needs **a line justifying it**
  ([architecture.md](../../docs/context/architecture.md) § *Dependency policy*).

Read [design-system.md](../../docs/frontend/design-system.md) and
[security.md](../../docs/context/security.md) § *Privacy*.

## Acceptance criteria

- [ ] One shared **`<Avatar>`** component under `src/app/_ui/`, ≤ 100 lines, taking a member's
      `userId` and `displayName`
- [ ] **Deterministic**: the same `userId` produces the same avatar on every render, every
      device, and every member's screen — two people looking at the same group see the same faces
- [ ] **Seeded by `userId`**, never by email, and not by a value that changes on rename
- [ ] Generated **in-process**. No runtime request to any third-party host, and no new outbound
      dependency in the request path
- [ ] The chosen library is named in the PR **with the reason**, and added to architecture.md's
      dependency list. Prefer the smallest thing that works — this is decoration
- [ ] Colours come from the **theme tokens**, not hardcoded hexes (design-system.md: "Never a
      hardcoded colour in a component"), and the avatar is legible in both light and dark
- [ ] **Never the only carrier of identity.** Every avatar sits beside the name it belongs to and
      is `aria-hidden` / decorative — a screen reader must not be handed a shape instead of a
      name, and colour-vision deficiency must not make two members interchangeable
- [ ] Rendered in: the Ajustes member list, balance member rows, the payment plan, payer and
      split rows in the expense detail, the settlement history, and the header user menu
- [ ] Sizes composed rather than configured — no nine-boolean-prop component
- [ ] Layout still works at 375px; avatars must not push amounts out of their column or break
      `tabular-nums` alignment
- [ ] Tests: the same `userId` renders identical output twice; two different ids differ; the
      avatar is not exposed to the accessibility tree as the member's identity

## Out of scope

Uploading an image. That introduces a file-storage mount and its permission traps — a separate
problem, deliberately deferred (`T091`, and see how it went in the sibling repo before designing
it). Letting a member *choose* a style is [T108](T108-avatar-style-picker.md), on purpose:
this task ships a good default with no schema change.

## Files likely touched

```
src/app/_ui/Avatar.tsx                 (new)
src/app/_ui/Avatar.test.tsx            (new)
src/app/(app)/g/[groupId]/_components/{MemberList,BalanceMemberRow,SettlementRow,ExpenseDetail}.tsx
src/app/_shell/UserMenu.tsx
docs/context/architecture.md
package.json
```
