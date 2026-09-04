# Deploy

Implements [ADR-0010](../../docs/adr/0010-deploy-via-ghcr-and-pull-timer.md): CI builds an
`amd64` image and pushes it to GHCR; the host polls and applies it. The host never builds, opens
no inbound port, and — while the GHCR package stays public — holds no GitHub credentials.

```
merge to main → CI green → release.yml builds & pushes ghcr.io/santiagovargasve/cuadre
              → this timer (every 5 min): fetch compose file → docker compose pull && up -d
```

## Host layout

```
<deploy-dir>/                     e.g. /srv/cuadre  (match cuadre-deploy.service's WorkingDirectory)
  docker-compose.yml              # synced from infra/docker-compose.prod.yml every tick (T130)
  .env                            # chmod 600, never in git — NEVER synced
  data/
    postgres/                     # the database's only copy — see "Backups"
```

## First-time setup

```bash
mkdir -p <deploy-dir>/data/postgres
cd <deploy-dir>
cp /path/to/repo/infra/docker-compose.prod.yml docker-compose.yml
# ^ a bootstrap only. From the first timer tick onward this file is fetched from
#   the repository and replaced (T130), so edit it in git, not here.
# write .env — every key named in the compose `environment:` block:
#   POSTGRES_USER POSTGRES_PASSWORD POSTGRES_DB
#   AUTH_SECRET APP_URL
#   SUPPORTED_CURRENCIES DEFAULT_CURRENCY FX_PROVIDER FX_BASE_CURRENCY FX_TRM_CROSSCHECK
#   FX_REFRESH_TOKEN   (only if you'll run the FX timer, T074)
chmod 600 .env
docker compose up -d
```

Then install the timer:

```bash
sudo cp cuadre-deploy.service cuadre-deploy.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now cuadre-deploy.timer
```

`APP_URL` must be the public origin exactly, no trailing slash — invite links are built from it.
Schema migrations run at app startup from `src/instrumentation.ts`; there is no migrate step here.

## Operating it

```bash
systemctl list-timers cuadre-deploy.timer      # when it next fires
journalctl -u cuadre-deploy.service -n 50      # what the last deploy did
systemctl start cuadre-deploy.service          # deploy right now
```

A tick with nothing new is cheap: one fetch of the compose file, plus a `pull` that is a no-op on
an unchanged digest. `up -d` recreates the container when the image moved **or** when the resolved
configuration changed — the second half is what makes an edit to `infra/docker-compose.prod.yml`
take effect, and is the mechanism the compose sync depends on.

**The compose file is synced; `.env` is not, and never will be.** It holds secrets, and it is
where every per-deployment difference belongs. A key added to the compose `environment:` block in
the repo reaches the deployment on the next tick; the *value* behind it still has to be in the
host's `.env` first.

## Rollback

Images are tagged `latest` and `sha-<commit>` (the full commit SHA). To pin a known-good build:

```bash
sudo systemctl stop cuadre-deploy.timer        # MANDATORY, not advisory — see below
# edit docker-compose.yml: image: ghcr.io/santiagovargasve/cuadre:sha-<commit>
docker compose up -d
```

Stopping the timer first became a **requirement** with T130. A pin edits the very file each tick
now overwrites, so an un-stopped timer doesn't merely outrun the pin — it erases it, and the
rollback silently undoes itself within five minutes.

Re-enable the timer only after moving the compose file back to `:latest`. A rollback that needs to
outlive an operator's terminal belongs in the repo, where the sync will carry it.

## Changing `.env`

This repo asserted for a long time that `docker compose up -d` does **not** recreate a container
when only an `.env` *value* changed, on the reasoning that `${VAR}` interpolation doesn't alter the
compose spec. **That was measured and is false** on Compose v2.39.4: an env-value-only edit
produces `Recreated` and the new value is live inside the container. Compose hashes the *resolved*
configuration, and interpolation happens before the hash.

Measured on a dev machine, not the deployment host — which runs a much newer Compose (v5.x), where
this was not re-verified. So `--force-recreate` stays the recommendation when you need certainty;
it is harmless and version-independent:

```bash
docker compose up -d --force-recreate
```

The claim mattered because it points the wrong way during an incident: it teaches "env changes
don't propagate", which is a plausible-sounding wrong answer to the T130 outage, where the real
cause was that the keys were never in the `environment:` allowlist at all.

Adding or removing a key in the compose `environment:` block *is* a spec change and recreates
normally. That block is an allowlist: a key in `.env` that isn't named there never reaches the
container.

## Backups

**`data/postgres/` is the only copy of data that cannot be reconstructed.** A wishlist item can
be re-added from its URL; a trip's ledger has no external source — if this directory is lost, the
record of who paid what and who owes whom is gone. This repo deliberately implements no backups
and makes no attempt to be self-healing about it. **The operator must back up `data/postgres/`**
(a periodic `pg_dump` from the `cuadre-db` container, or a filesystem snapshot with the container
stopped or `pg_start_backup`-aware). Verify a restore at least once.

## FX refresh timer

`cuadre-fx.{service,timer}` fetches COP/USD/EUR rates once a day — a **separate** unit from the
deploy timer, so the two can be reasoned about and disabled independently
([ADR-0008](../../docs/adr/0008-fx-provider-and-daily-refresh.md) § *The refresh*).

**A missed run is not an outage.** If a conversion needs a rate that isn't there, the app fetches
it on demand (T052's lazy fallback). The timer just keeps the common case warm.

### Install

```bash
# the token — same value as FX_REFRESH_TOKEN in .env — one line, root-only
sudo install -d -m 0700 /etc/cuadre
printf '%s\n' 'YOUR_FX_REFRESH_TOKEN' | sudo tee /etc/cuadre/fx-refresh.token >/dev/null
sudo chmod 600 /etc/cuadre/fx-refresh.token

sudo install -m 0755 cuadre-fx-refresh /usr/local/bin/cuadre-fx-refresh
sudo cp cuadre-fx.service cuadre-fx.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now cuadre-fx.timer
```

`cuadre-fx-refresh` reads the token from that file and **pipes it to the app over stdin** — it is
never a command-line argument, so it never lands in `ps` or the journal. The call goes to
`http://localhost:3000` *inside the app container*, so it doesn't depend on the tunnel being up.
If `WorkingDirectory`/paths differ, set `CUADRE_COMPOSE_DIR` / `CUADRE_FX_TOKEN_FILE` in the
service.

### Operating it

```bash
systemctl list-timers cuadre-fx.timer         # when it next fires (~02:00 UTC + up to 20 min)
journalctl -u cuadre-fx.service -n 20         # last run — logs `fx refresh ok: {inserted,asOf,source}`
sudo systemctl start cuadre-fx.service        # run it now
/usr/local/bin/cuadre-fx-refresh             # run it now, outside systemd
```

The endpoint is **idempotent** on `(base, quote, as_of, source)`: the first run of the day logs
`"inserted": 3` (or however many pairs), a second run the same day logs `"inserted": 0`. A
failure exits non-zero and the reason is on stderr in the journal.

## Why a timer, not a webhook or a runner

A webhook is another public endpoint and another shared secret. A self-hosted GitHub Actions
runner is worse: on a public repo, anyone who opens a pull request can execute code on it, and
this box sits inside a home LAN. Polling costs one registry request every five minutes and needs
no inbound anything.

## Secrets

Nothing in `infra/` contains a secret. `.env` lives only on the host, `chmod 600`, never
committed. `.env.example` (repo root) is the template.
