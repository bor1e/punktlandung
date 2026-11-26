---
mode: agent
description: Extract open points from a plan.md, Spec Kit spec.md, or OpenSpec proposal.md into a Punktlandung offline HTML overview.
---

Follow `AGENTS.md` and `skills/open-points-overview/SKILL.md` to turn the open points in the target specification into a validated single-file HTML overview:

1. Reuse an existing `context.json` if present, or bootstrap starter files with:
   `node scripts/init-case.mjs <target-markdown-file> [--context <existing-context.json>]`
2. Refine the generated `spec.json` against `schema/spec.schema.json`:
   - Keep topic count `<= openCount + unprovableCount`.
   - Give 2–4 concrete options per question grounded in the source document.
   - Set `"proposal": null` for fact questions; add `"reason"` wherever a proposal is set.
   - Assign exactly one `"A"` decider per question (never `"A"` or `"R"` to `"isPlatform": true` teams).
   - Add `"mootWhen"` rules for questions made irrelevant by a parent decision.
3. Compile and validate:
   `node scripts/build.mjs <context.json> <spec.json> -o <output.html>`
   `node scripts/validate.mjs <output.html>`
4. Summarize the generated file and remind the user how to merge returned `.html` copies or `PKL1:` codes with `node scripts/merge-answers.mjs --copilot-prompt`.
