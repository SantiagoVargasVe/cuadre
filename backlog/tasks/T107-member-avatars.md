---
id: T107
title: Deterministic generated avatars for members
epic: E12-first-use
status: done
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
  page — a privacy change, not just a dependency.

**The library is decided: [`boring-avatars`](https://github.com/boringdesigners/boring-avatars).**
Verified against `boring-avatars@2.0.4` on npm: **zero runtime dependencies** (React and
react-dom are peers, both already here), MIT, ~28 KB unpacked, and it generates pure SVG
in-process with no network request. That satisfies
[architecture.md](../../docs/context/architecture.md) § *Dependency policy* about as cheaply as a
runtime dependency can — record that line when adding it.

Its API, for reference:

```tsx
import Avatar from "boring-avatars";
<Avatar name={seed} variant="beam" size={32} colors={[...]} square title={false} />
```

`variant` is one of `marble` · `beam` · `pixel` · `sunset` · `ring` · `bauhaus`. `name` is the
seed — everything is derived from it deterministically. `colors` takes concrete hex values, which
is the one place this collides with "never a hardcoded colour in a component"; see the criteria.

Read [design-system.md](../../docs/frontend/design-system.md) and
[security.md](../../docs/context/security.md) § *Privacy*.

## Acceptance criteria

- [x] `src/app/_ui/Avatar.tsx` — `"use client"` (boring-avatars calls `useId`), ~50 lines, takes
      `userId` + optional `displayName`
- [x] **Deterministic**: the visual output is a pure function of `userId` — asserted (same id →
      identical SVG twice after normalising the one invisible `useId` mask id; different ids
      differ). Two viewers of the same group see the same faces
- [x] **Seeded by `userId`** — never email (`displayName` is passed only as a defensive fallback
      seed for an empty id, never otherwise); a rename does not change the avatar (asserted)
- [x] In-process via `boring-avatars` — pure SVG, no network. Verified against the built bundle:
      **zero runtime dependencies**
- [x] Added to `architecture.md` § *Dependency policy* with the line (zero runtime deps, MIT,
      ~28 KB, renders locally, pinned `2.0.4`)
- [x] Default variant: **`beam`** — looked at all six at 20–24px against the real member lists;
      `marble`/`sunset` blur to a gradient dot at that size, `beam`'s little faces keep the most
      per-member identity. T108 makes it changeable
- [x] `src/app/_ui/avatarPalette.ts` — one exported 6-hex constant, each entry commented with the
      theme token it flattens (`--primary` / `--chart-2` / `--chart-4` / `--credit` / `--accent`
      + one warm hue the theme lacks). Verified legible in light and dark
- [x] `aria-hidden` on the wrapper *and* the `<svg role="img">` — asserted that no `img` role
      reaches the accessibility tree. Every avatar sits beside its name; `beam`'s face geometry
      (not just colour) differentiates two members who land the same palette pair
- [x] Rendered in `MemberList`, `BalanceMemberRow`, `PaymentPlanRow`, `ExpenseDetail`'s
      `PartyRow` (payers + splits), `SettlementRow`, and `UserMenu`
- [x] One `size?: number` prop (default 28), not a wall of layout props
- [x] Verified at 375px, light + dark: avatars sit in a fixed leading column and do not push the
      right-aligned amounts or break `tabular-nums`
- [x] `Avatar.test.tsx`: same id identical, different ids differ, rename-stable, not in the a11y
      tree, plain size number

## Out of scope

Uploading an image. That introduces a file-storage mount and its permission traps — a separate
problem, deliberately deferred (`T091`, and see how it went in the sibling repo before designing
it).

Letting a member **change** their avatar is [T108](T108-avatar-editor.md), on purpose: this task
ships one good default with **no schema change**, so it can land immediately. Don't add a column
here, and don't build a picker here.

## Files likely touched

```
src/app/_ui/Avatar.tsx                 (new — wraps boring-avatars, owns the default variant + palette)
src/app/_ui/Avatar.test.tsx            (new)
src/app/(app)/g/[groupId]/_components/{MemberList,BalanceMemberRow,SettlementRow,ExpenseDetail}.tsx
src/app/_shell/UserMenu.tsx
docs/context/architecture.md
package.json
```
