# Greed: repository map

Gyral 0.3.1-next.1, TypeScript, Vite 8, Vitest, Three.js and Rapier. Online rooms
use Node 24, WebSockets and SQLite. Local and online matches are implemented;
public deployment and manual release checks remain.

## Start here

- [README.md](README.md): run the app and checks.
- [ARCHITECTURE.md](ARCHITECTURE.md): layers, ownership and invariants.
- [docs/index.md](docs/index.md): product and engineering documents.
- [docs/exec-plans/completed/full-game.md](docs/exec-plans/completed/full-game.md): delivered features.
- [docs/exec-plans/active/release.md](docs/exec-plans/active/release.md): remaining release gates.
- [docs/QUALITY_SCORE.md](docs/QUALITY_SCORE.md): evidence and limitations.

## Commands

| Command | Purpose |
| --- | --- |
| `npm ci` | Install exactly the lockfile; Node 24.15+ |
| `npm run dev` | Vite client; proxies server routes to port 8787 |
| `npm run dev:server` | Room server in another terminal |
| `npm run check` | Repository checks, types, templates, unit/browser tests, build |
| `npm run validate:physics -- 1000` | Seeded 6,000-roll diagnostic; writes a report |
| `npm run validate:online` | Built app: two real Chromium clients + reload |
| `npm run validate:ui` | Built app: themes, mobile, zoom, reduced motion |
| `npm run validate:container` | Built Docker image: guest roll and durable restart |
| `npm run validate:load` | Eight real rooms throwing simultaneously |
| `npm run backup -- source.sqlite new.sqlite` | Consistent live backup and integrity check |

Install Chromium once with `npx playwright install chromium`. Run `npm run check`
before handing off changes. For UI changes, also build and run UI validation.

## Essential invariants

1. `src/game` is pure. No randomness, clocks, DOM, storage, physics, network or UI imports.
2. Server room state is authoritative online. Browsers send moves, never rolled values.
3. Persist a transition before broadcasting it. Deduplicate action IDs; reject stale revisions.
4. Physics runs in a worker outside the room transition. Accept only the matching pending launch.
5. Gyral reducers/views/init are pure; effects are commands. Use named `data-intent`, not event closures.
6. Three.js imports belong in `src/rendering`; Rapier imports belong in `src/physics`.
7. Disconnect must release workers, subscriptions, sockets and graphics resources.
8. Change the product spec before changing a rule. Test the consequential behavior.
9. Use real browsers for component tests; no jsdom. Preserve semantic controls and reduced-motion support.
10. Keep guidance local and indexed. Update the quality report and execution plan with evidence.

## Skills

Read the relevant project-local skill before working in its area:

- [.agents/skills/gyral/SKILL.md](.agents/skills/gyral/SKILL.md)
- [.agents/skills/modern-css/SKILL.md](.agents/skills/modern-css/SKILL.md)
- [.agents/skills/semantic-html/SKILL.md](.agents/skills/semantic-html/SKILL.md)
- [.agents/skills/google-seo/SKILL.md](.agents/skills/google-seo/SKILL.md)
- [.agents/skills/sense-of-style/SKILL.md](.agents/skills/sense-of-style/SKILL.md)

The requested interactive game overrides the semantic skill's static/no-CSS scope;
apply its HTML/accessibility principles alongside modern CSS and JavaScript. Keep public
rules in static HTML. No invented domain, canonical URL, testimonials or ranking claims.

Preserve vendored release files and provenance. Do not edit tarballs or silently upgrade
Gyral. Do not commit, push, deploy or contact external people unless requested.
