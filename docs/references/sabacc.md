# Sabacc reference

Inspected source: the author's Sabacc game project (`sabacc-game-site`).
Source project uses the MIT license, copyright 2026 Mike Zupper. This project adapts
architecture concepts rather than copying its game rules, branding or assets.

Useful references: `ARCHITECTURE.md`, `src/server/room.ts`, `src/protocol/messages.ts`,
`src/state/remote-store.ts`, `src/server/db.ts`, `src/scene/sabacc-stage.ts`,
`test/unit/server.test.ts`, and the multiplayer path in `scripts/drive.ts`.

Borrowed concepts: one authority per room, common local/remote interface, seat tokens,
validated messages, version checks for asynchronous work, durable room snapshots,
graphics ownership in a custom element, and two-browser validation.

Greed-specific additions: server-side physical dice, recorded trajectories, action IDs,
client-visible revisions, save-before-broadcast, bounded worker jobs and outgoing bytes.
The initial backend uses Node + ws + Zod + SQLite. Deployment follows the same general
single-container shape; no Sabacc hosting configuration or credentials are copied.
