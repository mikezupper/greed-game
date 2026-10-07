# Architecture

Greed has one pure turn engine and two runtime adapters. Local play runs Rapier in a
browser worker; online play runs it in a Node worker. Three.js draws recorded motion.
The server is the only authority for online turns, scores and roll values.

```text
Gyral controls -> action driver -> local session OR remote session
                                      |                |
                                browser worker       WebSocket
                                      |                |
                                 Rapier module     server Room -> SQLite
                                                       |
                                                  Node worker
                                                       |
                                                  Rapier module

session snapshots -> Gyral controls + Three.js trajectory playback
```

## Dependency boundaries

| Layer | Allowed local dependencies | External dependencies |
| --- | --- | --- |
| `game` | game | none |
| `physics` | physics, game | Rapier; node worker entry may use worker_threads |
| `protocol` | protocol, game, physics | Zod |
| `server` | server, game, protocol, physics | Node, ws, Zod |
| `state` | state, game, protocol, physics | browser APIs at this runtime boundary |
| `app` | app, state, game, protocol | Gyral |
| `rendering` | rendering, physics, game | Three.js |

`scripts/check-repo.ts` enforces layer edges, pure-domain globals, package placement,
file size, documentation links and vendor hashes. Importing a runtime physics module
in state would add WASM to the main thread: use a worker URL instead. The shared types
are plain data. Domain types and protocol schemas are checked together by TypeScript.

## Online state and persistence

Each room processes synchronous transitions on Node's event loop. This serializes
accepted moves without holding a lock during simulation. An action carries a UUID and
expected room revision. Recent action receipts are stored with the game (bounded to
256). Exact retries return their receipt; new stale actions receive a fresh snapshot
and a rejection. A roll transition records its launch request and previous snapshot
before starting work. Completion is accepted only for the current revision.

Saving happens before replacing room state or broadcasting success. A pending saved
roll resumes on room load after restart. Completed trajectories are persisted, so
reconnecting clients receive the same roll. Guest identity uses random seat tokens;
only token hashes are stored server-side. Room codes are invitations, not identities.
Greed has public dice and scores, so card-hand redaction is unnecessary.

One worker and a maximum of 16 outstanding jobs bound the initial physics service.
Simulation is bounded to 1,800 fixed steps. Value-blind recovery stays in the original
world with the same seed. Worker timeouts retain the launch for retry. Completed throws
carry exact final frames; playback is capped at four seconds and the decision clock
starts afterwards. Client clocks are adjusted from snapshot server timestamps.

Room, connection, message-rate and payload limits bound the service. Empty rooms unload
after five minutes and persisted rooms expire after 24 hours without activity. Pong
liveness closes broken sockets. Production-host sustained load remains a release gate.

The match state records opening contenders, final-turn queues and sudden-death rounds.
The pure engine compares scores after equal turns. Room metadata owns host, readiness,
clock deadlines and departures. Latest-tab claims replace older live seat controllers.
Every recent receipt binds an action ID to its original revision and command. Database
schema migrations retain the legacy snapshot; native SQLite backups work while serving.

## UI ownership

Gyral watches session snapshots through a subscription driver. Moves and room actions
are commands. Reducers never call a socket, clock, RNG, worker or browser storage.
`<dice-tray>` owns graphics lifecycle and pointer picks. Accessible HTML buttons expose
the same selection actions. The tray never changes game state or decides a score.

Online clients replay server frames instead of re-simulating them. A slow client can
skip rendering frames and retain the final outcome. Reduced motion jumps to the end.
The local WASM worker is loaded only on the first local roll, and Three.js is a separate
client chunk. Instanced pips reduce draw calls. A separate held-dice shelf has canonical
positions/orientations, so a partial-roll reload reconstructs the same scene. Materials,
geometries, shadows, instance buffers, GPU contexts and listeners have explicit lifetimes.
Local storage records the table, latest trajectory and any pending launch; network state
is authoritative in SQLite. Public static rules are generated from shared scoring data.

## Sabacc influence

The room/store split, seat-token reconnects, validated wire messages, SQLite deployment
shape, custom-element graphics lifecycle, and two-client browser validation follow the
local Sabacc project. Greed uses plain TypeScript for its game and Zod + ws for the small
server; it does not require the Sabacc Effect runtime. Source details are recorded in
[the reference note](docs/references/sabacc.md).
