# Scaffold execution record

Started 2026-10-07. Scope: create a runnable repository and validate major uncertainties.

## Decisions

- Vendor Gyral 0.3.1-next.1 core/testing with checksums and source provenance.
- Keep the domain pure TypeScript; use Node 24 + ws + Zod + SQLite for the server.
- Run Rapier in workers and replay canonical trajectories online.
- Record baseline failures; introduce value-blind nudge recovery and rerun the same sample.
- Keep runtime controls semantic and public rules static; snapshot the requested skills.
- Use Vitest 4.1.11, which addresses the mocker advisory affecting 4.1.10.

## Implemented

Scoring and turn slice; local worker; Gyral controls; Three.js dice tray; server room
creation/join; token reconnect; persisted snapshots and pending rolls; action receipts;
revision checks; typed protocol; bounded physics queue and outgoing bytes; live socket
tests; browser component tests; production two-browser driver; diagnostic reports;
repository invariants; build and container scaffold.

## Findings

Initial six-dice settling failure was 18%; nudge recovery reduced this to 0.2% in the
same sample and 0.5% in an independent sample. It remains an uncertainty, not a closed
fairness claim. Nine of 12,000 recovery-model throws remained unresolved. Warm simulation
cost and compressed trajectory size are modest on this machine; concurrency and cold
mobile startup remain unmeasured. Full-match and lifecycle work is listed in
[the subsequent implementation record](full-game.md). Current verification is tracked in
[QUALITY_SCORE](../../QUALITY_SCORE.md).

The production two-browser and local UI checks passed, including a 320px layout fix.
A browser regression protects late custom-element property upgrades, and a worker
fixture matched Node's recorded trajectory. Container build, non-root execution and
persistent restart passed. The large local WASM and Three.js chunks remain visible
build/performance debt. The final check runs types, lint, tests, build and repository rules.
