# Validation and remaining uncertainty

Machine-readable evidence is [indexed here](../generated/README.md). Commands are in
[README](../../README.md). Reports describe their recorded version and environment.

## Physics

The initial launch model failed to settle 544 of 6,000 throws, including 18% of six-dice
throws. The first nudge model left nine unresolved throws across two 6,000-throw samples.
Those reports remain available; they describe superseded launch models.

The current `rapier-0.21.0/launch-3` model continues value-blind physical impulses in the
same world, using the original seed, for at most 1,800 steps. Both current 6,000-throw
samples settled every throw. The nine former failure launches are regression fixtures.
Aggregate/per-position face distributions, within-throw pair matrices and first-die
serial matrices are recorded. The matrix diagnostic showed no large joint or serial
chi-square values; multiple comparisons and finite sample size still matter.

Warm six-dice computation was about 6 ms median and 10 ms p95 on this host. Canonical
trajectory JSON was roughly 70 KB p95; a standalone gzip measurement was about 9 KB.
WebSocket framing/compression has different overhead. Visible playback is capped at
four seconds, with normalized quaternion interpolation and exact final frames.

These diagnostics do not prove independent fair faces or cross-platform identity.
Launch math uses JavaScript transcendental functions. Three browser worker trajectory
hashes match Node on this host, and online clients always replay the server recording.
Unresolved rolls and infrastructure failures retain their original launch; they do not
silently sample a fresh outcome. A stalled match offers retry or an explicit host reset.

## Game, network and persistence

The test suite exercises complete seeded matches and a real-socket 10,000-point physical
match, opening ties, final-turn ordering, equal-turn sudden death, timeout banking,
readiness, host/turn ownership, latest-tab takeover, read-only spectators, action
fingerprints, stale revisions, restart receipts, failed writes, pending-roll recovery,
backup restoration, configured metadata, command rates and oversized payloads.

Two independent production Chromium contexts completed a real 10,000-point match and
returned to the rematch lobby. Their values and scene poses matched, and reload restored
the original seat/trajectory. This harness disables server playback delays and raises
the command rate, while the separate UI and container checks retain normal playback.

## UI and performance

After the card-room redesign, desktop light, 390px dark with motion, 320px light with
reduced motion, and desktop dark with 200% root-font enlargement passed again, with no
axe violations. Dice are selected through the buttons the tray places over the 3D dice. The driver checks local worker startup, saved
roll restoration, skip-link/start/dice keyboard actions, 44px controls, overflow, console
errors and axe WCAG rules. Screenshots were inspected. Renderer regressions cover late
custom-element upgrades, playback, partial-roll/held-dice reconstruction, and repeated
GPU context teardown/recreation. Instanced pips reduce scene draw calls substantially.

Text enlargement is not native browser zoom; automated axe is not a screen-reader audit.
Software WebGL and localhost timings do not represent mobile hardware or a slow network.
The local compatibility worker and Three.js chunks remain material download costs.

Eight warmed rooms with 16 real clients completed simultaneous six-dice throws with
identical results per pair. The slowest response was about 96 ms, and process RSS was
about 358 MiB. This is a small single-machine burst sample, not sustained capacity.

## Delivery

The Node 24.21.0 image builds from the lockfile and runs as UID 1000 with a read-only root,
512 MiB/one-CPU limits, health checks and a writable SQLite volume. Guest rolls, live
backup integrity and seat/trajectory persistence after stop/start passed. Temporary test
containers and volumes were removed. Static HTML was checked with Nu; public-origin
metadata, compressed assets and crawler routes have HTTP tests.

Actual-host TLS, backups, mobile hardware, assistive technology and sustained capacity
are tracked in [the release plan](../exec-plans/active/release.md).
