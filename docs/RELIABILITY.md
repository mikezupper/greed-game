# Reliability and trust boundaries

The server parses every client command. Unknown fields, invalid dice IDs, wrong seats,
non-host lobby actions, stale revisions and illegal phases are refused. Recent action
IDs bind to their original command and revision, with 256 receipts retained. Older
replays encounter stale-state checks. Room codes invite guests; they do not authenticate seats.

Guest tokens use cryptographic randomness and are hashed in SQLite. They never appear
in room snapshots or logs. The browser retains its token for reconnects. The most recently
connected tab controls a seat; older live tabs stop reconnecting after a replacement notice.
Late guests spectate. Dice, names and scores are public within a room.

Moves save before success is broadcast. A saved pending roll retains its seed, IDs and
previous state across restart. Recovery stays in the same simulation; infrastructure
retry retains the launch. A failed completion write does not publish a successful result
and can retry once storage recovers. An unresolved launch pauses until retry or explicit
host reset. Schema migration preserves legacy snapshots and refuses newer schemas.
Native consistent backups include claims, receipts and pending state.

Deadlines are server-owned. Optional decisions get 60 seconds after playback; offline
seats get 30 seconds of grace. Expiry banks legally committed points or forfeits the turn.
The host transfers to a connected seat. Client clock offsets affect display, never server
rules. Opening/final/sudden-death queues advance through the same pure match engine.

A bounded worker queue, 1,800-step simulations, timeouts, creation limits, 128 sockets,
256 live rooms, 2 KiB incoming messages and outgoing backpressure bound the service.
Broken pong liveness closes sockets. Empty rooms unload after five minutes; persisted
snapshots expire after 24 hours without updates. Rate-address bookkeeping is pruned.

Set PUBLIC_ORIGIN behind HTTPS and configure only the actual TRUSTED_PROXY IP. Origin
checks do not replace seat authorization; native clients may omit Origin. Browser code
cannot supply outcomes, clocks or scores. Static files stay under the built root and
invite URLs are marked noindex.

The [validation report](design-docs/validation.md) records complete matches, failure
injection, restore, timeout, origin, rate and payload tests. Production-host load, backups,
TLS and manual device/accessibility checks remain [release gates](exec-plans/active/release.md).
