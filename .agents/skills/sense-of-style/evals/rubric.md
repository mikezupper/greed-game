# Reviewer rubric

Use after generating responses to [cases.json](cases.json). Do not give these criteria to the assistant being evaluated. Apply the scoring rules in [README.md](README.md#score-and-compare). Each case has three criteria; C1 is critical. Evaluate meaning, not exact phrasing.

## voice-preservation

- **C1 — Critical:** Clearly attributes the erased appointments to the calendar app and does not invent an event or change the reason for the paper backup.
- **C2:** Retains first-person perspective, deliberate repetition, and dry humor recognizable from the original. Identical jokes are not required.
- **C3:** Removes the ambiguous app reference and integrates or removes the redundant explanation naturally; returns only the passage.

## evidence-boundaries

- **C1 — Critical:** Does not generalize to customers, claim proof, or invent accuracy, retention, statistical significance, or causal evidence.
- **C2:** Preserves the six-employee internal trial, median times of 8 and 6 minutes, and absence of customer participants.
- **C3:** Uses two sentences and makes the limits of the evidence useful for deciding on a customer trial. It may omit unmeasured outcomes if it neither implies they improved nor obscures the internal-only evidence.

## light-edit-commitments

- **C1 — Critical:** Keeps October 6 and October 8 as proposed alternatives, September 30 as the reply deadline, and the distinction between discussing and approving the budget.
- **C2:** Keeps three paragraphs and a friendly client-facing tone without adding a commitment or changing the relationship.
- **C3:** Repairs the awkward meeting sentence while making only light edits, and returns only the email.

## critique-scope

- **C1 — Critical:** Identifies the unsupported generalization from four internal volunteers to every customer without inventing better evidence, pilot costs, or success thresholds.
- **C2:** Identifies the missing cost and success criteria as a decision obstacle and proposes obtaining or specifying them.
- **C3:** Gives two prioritized problems with a short representative repair for each, without rewriting the entire memo. Repairs may explicitly mark missing information.

## missing-brief

- **C1 — Critical:** On the first turn, asks for the missing purpose, audience, and format/category before drafting, and does not silently choose a deliverable.
- **C2:** Bundles the essential questions compactly and avoids an unnecessary questionnaire. Natural wording that resolves all three needs is sufficient.
- **C3:** After the second message, delivers a neutral two-sentence announcement using only weekly order totals and regional filtering, without restarting intake or inventing availability, access instructions, or benefits.

## explain-mechanism

- **C1 — Critical:** Preserves the distinction between immediate scanner recording and later screen updates; does not imply that shelf movements wait for upload or promise instantaneous updates on request.
- **C2:** Explains the intervening local queue and ten-minute upload cadence in language a new warehouse employee can understand.
- **C3:** Includes the supervisor's option to request an earlier upload without inventing buttons, commands, failure diagnoses, or workarounds.

## procedure-fidelity

- **C1 — Critical:** Preserves the open-case and Support Admin prerequisites, exact labels `Actions` and `Export case`, and their order; adds no unsupported action or workaround.
- **C2:** States that a ZIP download begins and that a workspace administrator should check the role if `Export case` is disabled.
- **C3:** Presents a concise numbered procedure with prerequisites available before the export action. Prerequisites and the disabled-action note may sit outside the numbered steps.

## marketing-proof

- **C1 — Critical:** Makes no unsupported claim about savings, customers, pricing, scarcity, or sending invoices; makes clear that invoices are drafts and are not sent by the product.
- **C2:** Accurately includes CSV timesheet import, grouping hours by client, and draft invoice export in language relevant to small consulting firms.
- **C3:** Uses two sentences and includes an invitation to book a demo without inventing a booking link or terms.

## short-form-scope

- **C1 — Critical:** Restricts current availability to the web app and preserves that mobile support is planned without a release date.
- **C2:** Accurately states that version 2.3 adds a weekly view available today; adds no other feature or release claim.
- **C3:** Produces one update of fewer than 50 whitespace-separated words, with no hashtags, emoji, thread, or closing question.

## contextual-usage

- **C1 — Critical:** Does not invent or imply a known actor, or alter the confirmed 09:15 timestamp if restating the event.
- **C2:** Explains why passive voice is reasonable when the actor is unknown and rejects the blanket rule without treating all passive constructions as preferable.
- **C3:** Gives a brief contextual explanation, preserves the explicit uncertainty, and either keeps the effective original sentence or offers a faithful optional revision.
