# Frontend and writing

Use the project-local Gyral, semantic HTML, modern CSS and Google SEO skills. Page-level
content uses light DOM. The static HTML contains the introduction and rules; game state
is interactive. Leave canonical/sitemap origins unset until a real domain is chosen.

Use native buttons, fieldsets, legends, labelled controls, score tables with captions
and scoped headers, output for computed scores, and polite status messages. Pointer
picking supplements equivalent keyboard controls. Avoid emoji as the only action label.

CSS uses ordered layers, perceptual theme tokens, logical properties, container queries,
44px targets, visible focus and forced-colors support. Three.js color strings are renderer
inputs, not CSS tokens. Reduced motion displays the settled roll without tumbling.
Reserve tray dimensions before graphics load. Never hide rules behind a canvas.

## Visual direction: a lamp-lit card room

The table is always lamp-lit: green felt, walnut frame, ivory dice, brass for points and
the main action, oxblood only for Farkle and risk. The page around it follows the
viewer's light or dark theme. Fraunces (display and numbers) and Commissioner (interface)
are self-hosted variable fonts; see [font provenance](references/fonts.md).

The component has three screens, chosen from the snapshot: a start screen (local seats
beside online create/join), an online waiting room, and the table. During a match the
static introduction is visually hidden so the table owns the first screen.

- The camera looks straight down, so the physical arena fills the felt as a rectangle.
  Tall screens turn it upright. The walnut frame, held-dice rail, decision bar, score
  lanes and overlays are HTML; only the felt is WebGL.
- `<dice-tray>` places a real button over each choosable die, positioned from the camera
  projection. Pointer, touch, keyboard and screen readers use those same buttons. Without
  WebGL they become flat pip dice in a row.
- Bank and Roll carry the current selection, so there is no separate Keep button. Roll
  shows the engine-derived Farkle chance for the dice it would throw.
- Scoring hints (on by default) glow under dice that can score; selection lifts a die and
  adds a brighter glow. Held dice appear on the rail, derived from snapshot values.
- Score lanes stay a real table: a bar toward the target, a striped segment for what
  banking now would add, and badges for turn, entry, final round and winner.
- Bank, Farkle, hot dice and victory are found by comparing consecutive snapshots in the
  reducer. Their animations run only with `prefers-reduced-motion: no-preference`.

The writing brief is explanatory UI copy for casual players, and technical documentation
for the owner and future contributors. Follow the Sense of Style skill: explain each
decision in plain language, preserve exact rules and commands, and distinguish verified
behavior from intended behavior. Sound is off until enabled by a player gesture. Playback completion
unlocks decisions; rendering cannot change scores. Keep held dice outside the physical
arena, and derive their poses from snapshot values so reconnects reproduce the scene.
