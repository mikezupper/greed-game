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

The writing brief is explanatory UI copy for casual players, and technical documentation
for the owner and future contributors. Follow the Sense of Style skill: explain each
decision in plain language, preserve exact rules and commands, and distinguish verified
behavior from intended behavior. The visual direction is felt, wood, ivory dice and
restrained lighting. Sound is off until enabled by a player gesture. Playback completion
unlocks decisions; rendering cannot change scores. Keep held dice outside the physical
arena, and derive their poses from snapshot values so reconnects reproduce the scene.
