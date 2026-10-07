# Full game implementation record

Feature implementation completed 2026-10-07. The owner requested the remaining feature
set after scaffold validation. External deployment and manual release checks remain in
[the release plan](../active/release.md).

## Delivered

- Complete pure match engine: opening-roll ties, fixed final-turn queue, winner selection,
  equal-turn sudden death, score reset and rematch lobby.
- Guest lobbies: readiness, host-only start/settings/rematch, invite prefill, late spectators,
  latest-tab seat control, explicit leave, disconnect grace and host transfer.
- Optional 60-second decision clock, started after playback; legal committed-point banking
  or forfeit at timeout; client/server clock offset compensation.
- Same-seed physics recovery in the original world, up to 1,800 steps. Infrastructure
  failure retains the pending launch; retry cannot generate another outcome. Stalled
  matches can be explicitly reset by the host.
- Local two-to-eight-player setup, browser save/resume, pending-roll recovery, scoring
  selection help, held-dice shelf, playback gating, optional sound and static tutorial.
- SQLite schema migration retaining original legacy snapshots, durable pending rolls,
  bounded fingerprinted receipts, live backups and restart validation.
- Idle unload, 24-hour persisted-room expiry, pong liveness, queue/rate/payload/socket limits,
  explicit trusted-proxy address handling and storage-error recovery.
- Instanced pips, lazy local physics, compressed static assets, canonical/sitemap generation
  from the configured origin, invite noindex, favicon and generated social image.
- Non-root read-only container, health check, resource/log limits, HTTPS proxy template,
  backup command and manually triggered CI checks.

## Evidence

The suite exercises seeded full matches, final-round/sudden-death edge cases, failure
seeds, socket authorization, duplicate/stale commands, failed writes, pending recovery,
clock expiry, host transfer, backup/restore, HTTP metadata, rate and payload limits.
Chromium worker hashes match Node for three seeds. Two production browser contexts
finish a real 10,000-point match and open a rematch lobby; themes, keyboard controls,
mobile layouts, local save, motion and axe checks run separately.

The current physics samples settled all 12,000 throws across two streams. An additional
matrix diagnostic records joint and serial checks. Historical adverse samples remain
available. The eight-room load sample and container restart/backup checks are retained
under [generated evidence](../../generated/README.md). See
[validation](../../design-docs/validation.md) for methodological limits.
