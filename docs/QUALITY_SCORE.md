# Quality score

Feature-complete local build, 2026-10-07. B = behavior tested; C = limited evidence.
No grade implies certification or production-host approval.

The final check passed 64 tests across ten files, strict types, lint, repository/vendor
checks and the production build. Online, UI, load and container reports are separate
integration evidence.

| Area | Grade | Evidence / limits |
| --- | --- | --- |
| Scoring and complete matches | B | Scoring, entry, hot dice, opening ties, final queue, equal-turn sudden death, rematch; seeded and real-socket full matches |
| Gyral integration | B | Strict types, template lint/compiler, real Chromium intents/effects and subscription teardown |
| Rapier | B | Current two 6,000-throw samples all settled; prior failure seeds covered; three Node/browser hashes; finite fairness evidence |
| Online room lifecycle | B | Ready/host/seat/turn checks, latest tab, spectators, clock/grace/host transfer, leave, bounded receipts and restart |
| Persistence and recovery | B | Failed-write behavior, pending recovery, schema migration/refusal, live backup integrity and durable container restart |
| Production client playback | B | Full two-browser 10,000-point match/rematch; shared poses, held-dice reload and repeated graphics teardown |
| Accessibility | B | Themes, 320/390/1440px, motion, 200% text, keyboard controls, 44px targets, axe; manual screen reader/native zoom outstanding |
| Performance | C | Instanced pips, compressed assets, local-worker startup, physics/payload diagnostics, eight-room burst; mobile hardware/sustained load outstanding |
| Repository harness | B | Layer/docs/vendor checks, portable skills, one check command and manual CI workflow |
| Public content | B | Static shared scoring/help, Nu HTML check, configured canonical/sitemap/social metadata and private-invite noindex |
| Deployment | C | Non-root read-only resource-limited container, guest roll, live backup/restart; actual domain/host/TLS not configured |

Reports are [indexed here](generated/README.md). See [validation](design-docs/validation.md)
for measurements and [the release plan](exec-plans/active/release.md) for manual/external gates.
