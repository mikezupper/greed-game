# Changelog

Notable changes to the writing skill, references, installation guidance, and packaging are recorded here. Versions correspond to Git tags; see [the release process](CONTRIBUTING.md#release-process).

## Unreleased

No pending changes.

## [0.2.0](https://github.com/mikezupper/the-sense-of-style-writing-skill/releases/tag/v0.2.0) — 2026-09-13

### Added

- MIT license for the original package and a matching license field in skill metadata.
- Ten original fictional evaluation cases covering the eight writing categories, clarification, and teaching.
- A separate reviewer rubric with 30 criteria, critical-failure rules, and an unfilled results template.
- A manual evaluation process for repeatable skill or model comparisons, with instructions to keep grading criteria out of model context.

### Changed

- README and contribution guidance now describe the license and evaluation collection.
- Pinned installation examples now point to v0.2.0.

### Validation and limits

- Evaluation JSON structure, case-to-rubric coverage, local links, license text, and skill metadata were checked.
- This release adds evaluation materials; it does not include executed model evaluations or benchmark scores.
- The editorial instructions are unchanged apart from license metadata.

## [0.1.0](https://github.com/mikezupper/the-sense-of-style-writing-skill/releases/tag/v0.1.0) — 2026-09-13

### Added

- Initial nonfiction writing skill with draft, revise, critique, and teach modes.
- Eight writing categories and six focused references covering reader knowledge, voice, coherence, sentences, revision, and sources.
- Guidance to preserve factual scope, uncertainty, authorial voice, and the requested editing depth.
- Original worked examples and source attribution without bundling the book or companion deep dive.
- OpenAI interface metadata and a detailed README with installation instructions, example prompts, and a repository guide.
- Claude Code and OpenCode installation guidance using the shared skill files.
- Contribution guidance, local-file ignore rules, and a documented release process with pinned installation examples.

### Validation and limits

- Local Markdown file links and Git whitespace checks were reviewed for this release.
- Claude Code and OpenCode installation locations were checked against their official documentation; live host behavior was not tested.
- No automated writing evaluation suite or measured cross-model results are included.
- A repository license has not yet been selected.
