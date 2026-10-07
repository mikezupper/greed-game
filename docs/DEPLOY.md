# Deployment and recovery

The app runs as one Node 24 service behind a reverse proxy you already operate, with
SQLite on a persistent volume. The image pins Node 24.21.0 and runs as UID 1000. This
repository ships no proxy: HTTPS, certificates and the public hostname belong to the proxy.

## Local production build

```sh
npm ci
npm run build
npm start
```

Open `http://127.0.0.1:8787`. The server reads `.env` when present; environment variables
already supplied by the process take precedence. `.env.example` lists the settings.

## Docker Compose behind an existing proxy

`compose.yml` runs only the game. It joins an **external** Docker network shared with the
proxy and publishes no host port; the proxy reaches the game as `http://greed:8787`.
The service has a read-only root, a named data volume, CPU/memory/PID limits, rotated
logs and a 15-second graceful shutdown.

1. Create the shared network once, with a fixed address range free on that host:

   ```sh
   docker network create --subnet 172.30.0.0/24 edge
   ```

2. Attach the proxy container to `edge` with a fixed address, for example `172.30.0.10`.
   For `cloudflared`:

   ```yaml
   services:
     cloudflared:
       image: cloudflare/cloudflared:<pinned version>
       command: tunnel --no-autoupdate run
       environment:
         TUNNEL_TOKEN: ${TUNNEL_TOKEN}
       networks:
         edge: { ipv4_address: 172.30.0.10 }
   networks:
     edge: { external: true }
   ```

   Route the public hostname to service `http://greed:8787` (dashboard: HTTP, `greed:8787`;
   or `ingress: [{ hostname: greed.example.com, service: http://greed:8787 }, { service: http_status:404 }]`).
   **Leave the HTTP Host Header override empty:** the app rejects room creation and live
   connections when `Origin` and `Host` disagree. Keep WebSockets enabled and Rocket
   Loader off in the Cloudflare zone.

3. Create `.env` beside `compose.yml`:

   ```env
   PUBLIC_ORIGIN=https://greed.example.com
   TRUSTED_PROXY=172.30.0.10
   CLIENT_IP_HEADER=cf-connecting-ip
   PROXY_NETWORK=edge
   ```

4. Start and check:

   ```sh
   docker compose up -d --build
   docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' <proxy container>   # must equal TRUSTED_PROXY
   ```

   Open `https://greed.example.com/healthz`, then play a match from two devices on
   different networks. Each should be able to create rooms independently.

To smoke-test the image without a proxy, build it and run `npm run validate:container`
(defaults to the `greed-dice-game:latest` tag).

## Visitor addresses and limits

Room creation is limited to 20 per visitor address per hour. Behind a proxy every request
comes from the proxy, so the app must learn the visitor's address from it:

- Only a request whose direct peer equals `TRUSTED_PROXY` may report an address. The same
  header from anyone else is ignored, so visitors cannot forge their own address.
- With `CLIENT_IP_HEADER` set, the app reads that header (Cloudflare sets
  `CF-Connecting-IP` to the visitor's address and overwrites any client-supplied value).
  Without it, the app uses the last `X-Forwarded-For` entry.
- If `TRUSTED_PROXY` is wrong or blank, everything still works, but all visitors share one
  limit. Check the proxy's address with `docker inspect` as above.

## Public metadata

Set `PUBLIC_ORIGIN` to the exact HTTPS origin, without a path or trailing slash. HTML then
receives canonical, Open Graph URL and social-image URLs; `/sitemap.xml` and `/robots.txt`
advertise the same origin, and invite queries receive noindex. Without an origin, sitemap
requests return 503 instead of publishing a fictitious URL. Hashed assets serve
Brotli/gzip and immutable cache headers; HTML stays revalidated, so a CDN needs no rules.

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
