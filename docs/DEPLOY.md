# Deployment and recovery

The app runs as one Node 24 service behind an HTTPS reverse proxy, with SQLite on a
persistent volume. The image pins Node 24.21.0 and runs as UID 1000. No remote host,
registry, domain or credentials have been configured.

## Local production build

```sh
npm ci
npm run build
npm start
```

Open `http://127.0.0.1:8787`. The server reads `.env` when present; environment variables
already supplied by the process take precedence. `.env.example` lists the settings.
For containers, Compose reads `.env` and passes the configured values.

```sh
docker build -t greed-dice-game:scaffold .
npm run validate:container
docker compose up -d --build
```

Compose binds the app to host loopback, uses a named data volume, limits CPU/memory/PIDs,
mounts the root read-only, rotates logs and allows 15 seconds for graceful shutdown.
The smoke check uses the same read-only/resource constraints and removes its test volume.

## HTTPS and metadata

Set `PUBLIC_ORIGIN` to the exact HTTPS origin, without a path or trailing slash. Set
`GAME_DOMAIN` for [the Caddy template](../deploy/Caddyfile); Caddy proxies HTTP and WebSockets.
Check DNS and certificate issuance on the actual host before publishing.

Node uses the direct peer address for room-creation limits. If a reverse proxy is in
front, set `TRUSTED_PROXY` to that proxy's exact IP as observed by Node. Only that peer's
last valid forwarded address is trusted; do not accept arbitrary forwarded headers.
A Docker gateway address can differ from host loopback, so inspect the actual topology.

With PUBLIC_ORIGIN set, HTML receives canonical, Open Graph URL and social-image URLs;
`/sitemap.xml` and `/robots.txt` advertise the same origin. Invite queries receive noindex.
Without an origin, sitemap requests return 503 instead of publishing a fictitious URL.
Hashed assets serve Brotli/gzip and immutable cache headers; HTML stays revalidated.

## Backups and restore

Use a new filename each time. The command refuses to overwrite a backup and runs an
integrity check on its consistent native SQLite copy. It works while the server runs.

```sh
npm run backup -- .data/greed.sqlite backups/greed-2026-10-07.sqlite
```

In a running container:

```sh
docker compose exec greed node scripts/backup.ts /app/.data/greed.sqlite /app/.data/backup-2026-10-07.sqlite
docker compose cp greed:/app/.data/backup-2026-10-07.sqlite backups/backup-2026-10-07.sqlite
```

Keep copies outside the data volume and public web root. Before restoring, stop the
service and archive its current `.sqlite`, `-wal` and `-shm` files together. Put the verified
backup at the configured database path, with no old WAL/SHM at that live path. Preserve
UID 1000 write access in containers. Start, check `/healthz`, reclaim a saved seat and
verify its score/trajectory. Never replace a database underneath a running process.

Schema version 2 migrates legacy practice snapshots while preserving originals in
`legacy_rooms`. A newer unknown schema is refused. Take an external backup before upgrades.
Guest claims and action receipts are part of the backup; treat it as private operational data.

## Operations and release

`/healthz` checks process reachability, not storage durability or load capacity. The
service emits structured startup and persistence-failure events without seat tokens.
Pong liveness, idle unload, persisted expiry, worker limits and slow-socket limits bound
resource use. Measure sustained capacity on the actual host; the current benchmark is
eight warmed simultaneous rooms, not a hosting guarantee.

The manual self-hosted CI workflow runs checks, a complete browser match, UI/axe and
load checks. Connect a runner deliberately. Complete [the release gates](exec-plans/active/release.md)
before public deployment; nothing has been published by this task.
