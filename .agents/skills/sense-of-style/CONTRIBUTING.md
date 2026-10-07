# Contributing

Improvements should help the assistant make a better editorial decision for a specific reader and task. Favor focused guidance and original examples over longer lists of universal rules.

## Propose a change

Open an issue describing the writing category, intended audience, requested outcome, and observed problem. Include a short fictional or anonymized passage when it helps. Explain the expected behavior without assuming that one preferred rewrite is the only acceptable answer.

For a pull request, describe the problem, what the revised guidance changes, and how you reviewed it. Keep unrelated editorial changes separate.

## Where changes belong

- Put scope, routing, and shared workflow changes in `SKILL.md`.
- Put category-specific decisions in `references/writing-categories.md`.
- Put detailed guidance and worked examples in the relevant reference.
- Keep `agents/openai.yaml` consistent with the skill name and purpose.
- Update the README when installation, structure, or supported behavior changes.

## Review criteria

Check that instructions preserve authorial voice, factual scope, attribution, uncertainty, and the user's requested editing depth. Avoid blanket bans on grammatical constructions and avoid prescribing a single structure across genres.

For behavior changes, try a representative prompt and inspect the result against the original brief. Include a counterexample when the advice has a meaningful exception. Report what you actually reviewed; do not describe a model review as testing with real readers.

Before committing, check relative Markdown links and run:

```bash
git diff --check
git diff --stat
git diff
```

There is no build step or automated evaluation runner. Use the [manual evaluation collection](evals/README.md) for changes that may affect writing behavior. Preserve the separation between input prompts and reviewer criteria, record the exact revisions, and report actual outcomes rather than inferred scores. Changes to prose do not require implementation-mirroring tests.

## Sources and private material

Use original or appropriately attributed examples. Keep full copyrighted books, conversions, companion source documents, credentials, personal notes, and client drafts outside the tracked package. Consult `references/sources.md` for provenance and private-reference boundaries.

Original contributions to this package are provided under the [MIT license](LICENSE). Do not add third-party material whose reuse terms are unclear; the repository license does not relicense the source book or other referenced works.

## Release process

Use `vMAJOR.MINOR.PATCH` Git tags as the version source of truth. While versions begin with `0`, increment the minor number for substantive behavior or compatibility changes and the patch number for corrections that preserve intended behavior. Describe changed expectations explicitly; do not imply that identical prompts will produce identical prose.

1. Collect notable changes under `Unreleased` in `CHANGELOG.md`.
2. Review the affected guidance and installation instructions. Check local links and run `git diff --check`. For behavior changes, record representative prompt reviews and their limits.
3. Move the pending entries into a dated version section and update the README's release link and pinned-install example.
4. Commit and push the reviewed files to `main`.
5. Create an annotated tag on that commit and push that tag explicitly.
6. Create a GitHub release using `--verify-tag` and a notes file containing that version's changes and validation limits.
7. Verify the release points to the intended commit and that the repository retains its intended visibility.

Never move a published version tag to a different commit. Publish a new patch or minor version for corrections. The repository's privacy setting continues to govern access to its releases.
