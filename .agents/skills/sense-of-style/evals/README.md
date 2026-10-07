# Writing evaluations

Ten small cases check whether a skill revision or a different model changes the editorial behavior that matters. They cover all eight writing categories, plus clarification and teaching. The inputs are fictional and original to this collection.

This is a manual evaluation collection, not an automated test runner. No model results are bundled, and no performance claims have been established. Structural validation of these files does not count as running the evaluations.

## Files

- [cases.json](cases.json) contains only case identifiers and user messages, so it can be supplied without revealing grading criteria.
- [rubric.md](rubric.md) contains reviewer-only criteria for each case.
- [results-template.md](results-template.md) records the environment, outputs, judgments, and comparison findings.

Keep the rubric and prior results out of the model's context. If the model can browse this repository, run in a separate workspace containing only the skill entry point, `agents/`, and `references/`, with the evaluation files kept outside that workspace.

## Run a baseline

1. Choose an exact skill commit or release tag, a host, and a model. Record them in a copy of the results template, along with any host instructions, model settings, and other enabled skills that might influence writing.
2. Start a fresh conversation for each case. Load the skill explicitly using the host's invocation mechanism, then supply only that case's messages in order. For the two-turn clarification case, wait for the first response before sending the second message.
3. Save the complete messages and responses outside the skill package. Do not correct the model or reveal the rubric during a run. If the model asks an unplanned question, record it rather than inventing an answer that changes the case.
4. After generation, review the output against the case criteria. Quote or point to evidence for each judgment. A human should resolve disputed judgments; model-assisted reviews must be identified as such.
5. Record every case, including failures and cases you could not run. Report completed cases as a fraction of the ten, alongside critical failures and ordinary misses.

A single run is a quick smoke check, not a reliable estimate of performance. For a more useful comparison, run each case three times per configuration in fresh conversations and preserve all results. Never select only the best attempt.

## Score and compare

Each case has three binary criteria, including one marked **critical**. Mark each criterion `pass`, `fail`, or `not assessed`, with a short reason. A case passes only when all three criteria pass. Any failed critical criterion makes the case a **critical failure**, regardless of its other scores. A case with an unassessed criterion is incomplete and must not be counted as a pass.

The collection has 30 criteria per full run. Report passing criteria over assessed criteria, completion, case passes, and critical failures separately. A high aggregate score must not conceal an invented fact or changed commitment. `Not assessed` is for missing evidence or an incomplete run, not a way to excuse an unmet requirement.

Compare baseline and candidate outputs using the same case inputs, host instructions, and settings. When checking a skill change, hold the model fixed; when comparing models, hold the skill revision fixed. If both change, describe the comparison as confounded. Where practical, hide configuration labels and vary output order while reviewing to reduce preference bias.

Investigate new critical failures first, then recurring losses in clarity, voice, or task fit. Keep the original cases fixed during a comparison. If an input or rubric needs revision, record that change and rerun both configurations on the revised collection.

## Limits

Accept different wording and organization when they satisfy the brief and preserve meaning. Do not grade by exact string matches, readability scores, or sentence length alone. A response may keep an already effective sentence.

These cases assess explicitly invoked editorial behavior. They do not test automatic skill discovery, real reader comprehension, long-document consistency, every writing category's edge cases, or factual accuracy on external subjects. Host instruction conflicts should be documented rather than automatically attributed to the skill.

There is no universal passing score that makes a skill production-ready. Use failures to guide focused review, and add new cases when actual use reveals a distinct problem. Keep private drafts, copyrighted source material, credentials, and identifying information out of committed examples and results.
