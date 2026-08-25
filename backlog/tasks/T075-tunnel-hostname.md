---
id: T075
title: Add the app hostname to the Cloudflare Tunnel
epic: E8-deploy
status: todo
depends_on: [T073]
size: S
---

## Context

Making the app publicly reachable without opening a router port. This is a **manual dashboard
action**, not code — the task exists so it isn't forgotten and so the gotchas are written down.

Read [ADR-0010](../../docs/adr/0010-deploy-via-ghcr-and-pull-timer.md) and
[architecture.md](../../docs/context/architecture.md) § *System*.

## Acceptance criteria

- [ ] A public hostname on the existing tunnel routes to `http://cuadre-app:3000`
- [ ] `cloudflared` is joined to the app's network as an **`external` network declared in the
      compose file that owns `cloudflared`**. `docker network connect` also works but is ephemeral
      and silently breaks on the next recreate — don't use it for anything permanent
- [ ] `APP_URL` on the host matches the public hostname exactly, no trailing slash. Invite links
      are built from it, and a mismatch produces links that don't work
- [ ] The `Origin` check from T012 accepts that origin — verify a real login from the public URL,
      not just locally
- [ ] **No router port forwarding.** Inbound reaches the app only through the tunnel, which is also
      the assumption that makes trusting `CF-Connecting-IP` for rate limiting valid
      ([security.md](../../docs/context/security.md))
- [ ] Verified end to end from outside the LAN: register through an invite link, create a group,
      add an expense
- [ ] Nothing host-specific committed to this repo — the hostname lives in the operator's notes and
      in `.env`, not in the code

## Out of scope

DNS for anything else. TLS — Cloudflare terminates it.

## Files likely touched

```
(none — dashboard action; note the outcome in the PR that closes this task)
```
