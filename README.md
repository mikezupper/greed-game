# Greed

A complete local and online Greed/Farkle game. Real Rapier dice tumble in a Three.js tray;
the server owns online results, turns and scores. Gyral 0.3.1-next.1 is vendored with checksums.

Play with two to eight guests. The game includes opening-roll ties, entry scoring,
hot dice, a 10,000-point final round, equal-turn sudden death, and rematches. Online rooms
have readiness, host transfer, an optional decision clock, reconnects and spectators.
Local tables save in your browser. Keyboard dice buttons, reduced motion, themes, help,
scoring-selection assistance and optional sound are included.

## Run

Use Node 24.15+ within the 24.x line:

```sh
npm ci
npm run build
npm start
```

Open `http://127.0.0.1:8787`. For development, run `npm run dev:server` and `npm run dev`
in separate terminals, then open `http://127.0.0.1:5173`. Local play also works without
the room server. Open Local players to set names, then Start game.

For online play, enter a name, create a room, and share its invite link. Everyone chooses
Ready to play before the host starts. Reloading restores your seat in the same browser;
a second tab takes control of that seat. Room data lives in `.data/greed.sqlite`.

## Validate

Install browser tooling once with `npx playwright install chromium`.

```sh
npm run check
npm run validate:online
npm run validate:ui
npm run validate:load
npm run validate:physics -- 1000 0x4b71a239 physics-independent-release.json
docker build -t greed-dice-game:scaffold .
npm run validate:container
```

Browser drivers use `dist/`; rebuild after UI changes. The online driver completes a
real 10,000-point match using reduced motion and accelerated server delays. The UI driver
checks normal playback separately. Reports are [indexed here](docs/generated/README.md);
screenshots stay in `.artifacts/`. Read the [evidence and limits](docs/design-docs/validation.md).

The container check removes its temporary container and volume. Back up a live database:

```sh
npm run backup -- .data/greed.sqlite backups/greed-2026-10-07.sqlite
```

Existing backup files are never overwritten. Restore procedures, HTTPS proxy configuration,
resource limits and domain metadata are in [deployment notes](docs/DEPLOY.md).

## Repository

Start with [AGENTS.md](AGENTS.md), [ARCHITECTURE.md](ARCHITECTURE.md), and the
[documentation index](docs/index.md). The requested skills are portable snapshots under
`.agents/skills`, with [provenance](docs/references/skills-provenance.json). Gyral core and
testing install from `vendor/gyral/0.3.1-next.1`; no sibling checkout is required.

Feature implementation is [recorded here](docs/exec-plans/completed/full-game.md).
[Release gates](docs/exec-plans/active/release.md) cover the actual domain/host, manual
assistive-technology and mobile hardware checks, and operational validation on that host.
No remote deployment has been performed.
