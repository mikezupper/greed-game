# Card-room UI redesign

Status: complete on branch `ui-redesign`, 2026-10-07. The owner approved a clickable
prototype and asked to keep real physics and 3D dice in its style.

## Delivered

- Start screen, online waiting room and table screen chosen from the snapshot.
- Overhead camera that fits the physical arena to the felt, upright on tall screens.
- Real buttons over the 3D dice replace the numbered die row; flat pip dice without WebGL.
- Bank and Roll carry the selection (rules spec updated first); exact Farkle odds from the
  scoring engine on the Roll button and in the static rules.
- Held-dice rail, race-to-target score lanes, scoring hints, and bank/Farkle/hot-dice/
  victory moments derived from consecutive snapshots.
- Lamp-lit token palette, self-hosted Fraunces and Commissioner.

## Evidence

`npm run check`, `validate:ui` (four layouts, axe clean) and `validate:online` (complete
two-browser match, reconnect, rematch) passed after the change. Screenshots were reviewed.
Remaining checks are listed in the [debt tracker](../tech-debt-tracker.md).
