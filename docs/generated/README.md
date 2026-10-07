# Generated evidence

- `physics-baseline.json`: initial launch model, 6,000 seeded throws; adverse results retained.
- `physics-report.json`: superseded launch-2 tuning sample; four unresolved throws retained.
- `physics-independent.json`: superseded launch-2 independent sample; five unresolved throws retained.
- `physics-release.json`: launch-3, 6,000 settled throws; distributions, payload and compute cost.
- `physics-independent-release.json`: launch-3, another 6,000 settled throws; face distributions,
  within-throw pair and first-die serial matrices. Finite samples do not certify fairness.
- `online-report.json`: two production browser contexts, shared poses, invite/readiness,
  seat reload, complete 10,000-point match and rematch.
- `ui-report.json`: themes, 320/390/1440px, motion, text enlargement, keyboard controls,
  local worker startup/save restoration, draw calls, target sizes, axe and console checks.
- `load-report.json`: eight warmed rooms/16 clients throwing simultaneously; latency and RSS.
- `container-report.json`: non-root read-only image, resource limits, real guest roll,
  live backup and seat/trajectory restoration after restart.
- `html-report.json`: Nu HTML Checker response for the built static document.

Generate reports with the validation commands in [README](../../README.md). Reports
describe the run that produced them; a later code change can invalidate their evidence.
The producer records its timestamp and engine or scenario. Screenshots are local artifacts
under `.artifacts/` and are not checked into the repository.
