# Copilot Instructions — Punktlandung

Use this repository to turn open points in any `plan.md`, GitHub Spec Kit `spec.md`, or OpenSpec `proposal.md` into one self-contained HTML overview (`open-points.html`) and merge returned answers back into the source Markdown.

## Two-Layer Model
1. **Team Context (`context.json`)** — defined once per team (roles, colors, `isPlatform` guards, constraints) conforming to `schema/context.schema.json`. Reuse an existing `context.json` instead of creating a new one per feature.
2. **Feature Spec (`spec.json`)** — open points for one feature/plan conforming to `schema/spec.schema.json`.

## Standard Commands
- Scaffold starter JSON from Markdown:
  `node scripts/init-case.mjs <plan.md|spec.md|proposal.md> [--context <context.json>]`
- Compile & validate offline HTML:
  `node scripts/build.mjs <context.json> <spec.json> -o <open-points.html>`
- Validate repo sync & all HTMLs:
  `node scripts/validate.mjs`
- Merge returned stakeholder copies into a Copilot prompt:
  `node scripts/merge-answers.mjs --copilot-prompt returned-*.html`

## Non-Negotiable Rules
1. **Topic budget:** Number of unique topics (`topic || id`) must be `<= openCount + unprovableCount` of the source spec.
2. **Closed questions:** 2–4 concrete options per question, plus source `context`. Never invent requirements not in the source.
3. **Facts vs. proposals:** Set `"proposal": null` for fact questions (formats, names, external rules); provide a `"reason"` whenever `"proposal"` is set.
4. **RACI ownership:** Exactly one `"A"` decider per question. Any party with `"isPlatform": true` must NEVER have `"A"` or `"R"`.
5. **Conditional dimming:** Use `"mootWhen": { "id": "<parent-id>", "eq": "<optionIndex>", "reason": "..." }` so dependent questions dim automatically.
6. **Epistemic cleanup:** Returned answers update the source `plan.md`/`spec.md`/`proposal.md`, never the generated HTML directly.
