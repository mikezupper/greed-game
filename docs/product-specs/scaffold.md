# Scaffold acceptance

This historical specification records the first scaffold milestone. The subsequent
[full-game implementation](../exec-plans/completed/full-game.md) delivers the match
system; [release gates](../exec-plans/active/release.md) track public deployment.

The scaffold must:

1. Install from a lockfile with verified Gyral 0.3.1-next.1 tarballs, without sibling-repo dependencies.
2. Build and test strict TypeScript, Gyral templates, domain transitions and real browser components.
3. Render real Rapier motion with readable Three.js dice, semantic controls, themes and reduced motion.
4. Host at least two guest clients in one room, validate turns, persist state and restore a seat.
5. Show both clients the same trajectory and settled values; reject stale or duplicate actions correctly.
6. Measure seeded physics outcomes, settling, simulation cost and payloads; retain adverse findings.
7. Keep guidance, decisions, evidence and executable checks in the repository.

At the scaffold milestone, the practice table began on the first legal roll, permitted
score accumulation past 10,000 and had no winner screen. The complete application now
uses opening rolls, final turns, sudden death, a winner screen and rematch lobbies.
