# Deploy

Implements [ADR-0010](../../docs/adr/0010-deploy-via-ghcr-and-pull-timer.md): CI builds an
`amd64` image and pushes it to GHCR; the host polls and applies it. The host never builds, opens
no inbound port, and — while the GHCR package stays public — holds no GitHub credentials.

```
merge to main → CI green → release.yml builds & pushes ghcr.io/santiagovargasve/cuadre
              → this timer (every 5 min): docker compose pull && up -d
```

## Host layout

```
<deploy-dir>/                     e.g. ~/nas/cuadre  (match cuadre-deploy.service's WorkingDirectory)
  docker-compose.yml              # a copy of infra/docker-compose.prod.yml
  .env                            # chmod 600, never in git
  data/
    postgres/                     # the database's only copy — see "Backups"
```

## First-time setup

```bash
mkdir -p <deploy-dir>/data/postgres
cd <deploy-dir>
cp /path/to/repo/infra/docker-compose.prod.yml docker-compose.yml
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

A tick with nothing new is cheap: `pull` is a no-op on an unchanged digest and `up -d` only
recreates a container when the image actually moved.

## Rollback

Images are tagged `latest` and `sha-<commit>` (the full commit SHA). To pin a known-good build:

```bash
sudo systemctl stop cuadre-deploy.timer        # FIRST — or the next tick pulls `latest`
                                               #   straight back over the pin
# edit docker-compose.yml: image: ghcr.io/santiagovargasve/cuadre:sha-<commit>
docker compose up -d
```

Re-enable the timer only after moving the compose file back to `:latest`.

## Changing `.env`

`docker compose up -d` does **not** recreate a running container when only an `.env` *value*
changed — it compares the compose spec, and `${VAR}` interpolation doesn't alter it. Force it:

```bash
docker compose up -d --force-recreate
```

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

## Related units

- `cuadre-fx.{service,timer}` (T074) — the daily FX rate refresh. A separate unit on purpose; a
  missed run is **not** an outage, because the conversion path fetches on demand as a fallback.

## Why a timer, not a webhook or a runner

A webhook is another public endpoint and another shared secret. A self-hosted GitHub Actions
runner is worse: on a public repo, anyone who opens a pull request can execute code on it, and
this box sits inside a home LAN. Polling costs one registry request every five minutes and needs
no inbound anything.

## Secrets

Nothing in `infra/` contains a secret. `.env` lives only on the host, `chmod 600`, never
committed. `.env.example` (repo root) is the template.
