---
name: open-points-overview
description: "Turns the open points of any plan.md, Spec Kit spec, or OpenSpec proposal into one self-contained HTML page on which each party selects answers and sends them back. Uses a reusable team context.json plus a per-plan spec.json. Triggers on: 'overview for the business department', 'open questions page', 'who decides what', 'RACI for the open points', 'make the spec ready for implementation'."
version: 2.3.2
---

# Open Points Overview (Two-Layer Model)

A `plan.md` or spec with open points cannot be implemented safely — especially when an AI coding agent implements after release. This skill turns open points into one offline HTML page where each party answers its questions with a click, and merges returned copies back into a decision patch.

The page is a reading version of the spec. It adds no requirement and decides nothing.

## Two-Layer Architecture

1. **`context.json` (`schema/context.schema.json`, defined once per team/project):** Roles, colors, RACI responsibilities, platform flags (`isPlatform`), language (`de`/`en`), and environment constraints (e.g. "AI implements after release"). Reused unchanged across every `plan.md`.
2. **`spec.json` (`schema/spec.schema.json`, generated per `plan.md` / feature set):** Only the open points, options, proposals, RACI assignments, declarative `mootWhen` branching / optional keystone, and optional use-case scenarios.
3. **Scaffold, Compile & Merge:**
   - Scaffold starter files: `node scripts/init-case.mjs <plan.md|spec.md|proposal.md> [--context <context.json>]`
   - Build: `node scripts/build.mjs context.json spec.json -o open-points.html`
   - Merge returned files: `node scripts/merge-answers.mjs [--json|--copilot-prompt] returned-*.html`

## Lifecycle Boundary (Start to End)

- **Starts:** When a `plan.md`, Spec Kit `spec.md` (`[NEEDS CLARIFICATION]`), or OpenSpec `proposal.md` has unresolved open questions or untestable statements.
- **Ends:** When `merge-answers.mjs` reports `0` open and `0` conflict items, the resolved decisions are folded back into the source spec (`plan.md` / `spec.md` / `proposal.md`), and ephemeral `spec.json` / `*.html` files are removed or archived before implementation / OpenSpec archive.

## Activation

Trigger this protocol when:
- User request contains: "overview for the stakeholders", "open questions", "who must answer what", "RACI", "ready for implementation"
- The context indicates: a `plan.md`, Spec Kit `spec.md`, OpenSpec `proposal.md`, or feature set exists and lists open points, `[NEEDS CLARIFICATION]`, `TODO` entries, or untestable statements

---

## Protocol / Workflow

1. **Reuse or create `context.json` (conform to `schema/context.schema.json`).**
   - Look for an existing `context.json` in the project first; do not reinvent roles or colors per feature.
   - Merge parties that the reader sees as one party. Ask the user when unsure who is who. Do not guess a team's role from its name.
   - Mark any central platform/ops team with `"isPlatform": true` and give it no product requirement questions (only `C` where build/deployment changes).
   - Ask who implements. If an AI implements after release, assign no question to a development team: the code answers questions about built behaviour.
   - Include environment constraints in `context.constraints` and state `context.assignmentNote` when RACI is a proposal.

2. **Count the open points of the spec.** Write down `openCount` (open points) and `unprovableCount` (statements that cannot be tested). These numbers are the limit for `spec.json`. The page gets no topic that the spec does not have.

3. **Find the keystone question & conditional branches (`mootWhen`).**
   - Look for the question whose answer decides if other questions exist (for example: two designs or sync vs. async).
   - Configure `spec.keystone` for the primary fork and/or per-question `"mootWhen": { "id": "<parent-id>", "eq": "<optionIndex>", "reason": "..." }` (or an array of rules) so dependent questions dim automatically when a parent answer removes them.

4. **Write each open point as a closed question in `spec.json` (conform to `schema/spec.schema.json`).**
   - You can bootstrap `spec.json` with `node scripts/init-case.mjs <input.md>`.
   - Give two to four complete, selectable `options`. ("Other" with a text field and an optional note are added automatically by the template.)
   - Add `context` naming what the sources say, with the source. Do not add what no source says.
   - If one open point contains more than one question, divide it into sub-questions sharing the same `"topic"` ID and register the topic title in `spec.topics`.

5. **Recommend, with a reason, where a recommendation is possible.**
   - Set `"proposal"` to the 0-based index and explain why in `"reason"` (1–2 sentences).
   - Set `"proposal": null` for a question about a fact (a format, a name, a rule that exists somewhere) and state who knows the fact.
   - A proposal is never a requirement.

6. **Assign exactly one deciding party (`A`) per question.**
   - Use `A` (decides, exactly one), `R` (supplies the answer), `C` (consulted before), `I` (informed).
   - Group questions by reading order (`spec.groups`) — by use case when scenarios exist, or by logical topic groups for a lightweight `plan.md` — while preserving the spec ID in `"ref"`.

7. **Build and validate one self-contained HTML file.**
   - Run `node scripts/build.mjs <context.json> <spec.json> -o <output.html>`.
   - The compiler injects `{ context, spec }` into `template/overview.html` and validates all invariants automatically (no external scripts/fonts, default view shows all questions, one color per party, topic limit respected, exactly one `A` per question, no `A`/`R` on platform teams, valid `mootWhen` references).

8. **Verify in a browser & handle the return trip.**
   - Confirm draft persistence (`localStorage`), TiddlyWiki-style dirty indicator + "Save with answers" (`#saved` embed via File System Access API or download fallback), quick Copy/Email reply fallback, plain-text summary, and AI-Bot JSON copy.
   - When readers send back copies, run `node scripts/merge-answers.mjs [--json|--copilot-prompt] returned-*.html` to resolve each decider's (`A`) answer, respect `mootWhen` / keystone muting, surface conflicts, and patch `plan.md`. Then rebuild until zero open points remain.

9. **Keep the page to its purpose.** Process rules (release flow, git versioning) belong in `README.md`, not in the generated HTML.

10. **Anonymise with a script, if the page is to be shared publicly.**
    - Replace identifying terms via a deterministic mapping table, strip links/images, fail on missing replacements, and check against a forbidden-terms list. Keep the mapping script private.

---

## Error Handling / Edge Cases

- **The page has more questions than the spec has open points**: valid only when split into sub-questions under a shared `topic` ID (`topics.size <= openCount + unprovableCount`). Otherwise remove or report as a new open point for the spec.
- **A reader says two parties are the same**: merge them in `context.json` and take the highest RACI letter per question (`A > R > C > I`).
- **No source says who decides**: propose an assignment, explain it in `context.assignmentNote`, and ask the user to confirm.
- **The keystone question has no answer**: do not delete dependent questions; mark them with `keystoneDependent: true` / `mootWhen`.
- **Corporate email blocks `.html` attachments**: share via SharePoint/Intranet link or have readers click **Copy reply text** / **Send via email**.
- **An answer comes back**: answers update `plan.md` / the spec, not the generated HTML directly. Update the spec version and rebuild.

---

## Mandatory Checklist

When building or reviewing the page, complete this checklist:

1. [ ] Verify that the number of topics is not higher than `openCount + unprovableCount` of the spec, and that the page explains its numbers
2. [ ] Verify that each question has 2–4 closed options, "other" with a text field, and a context that names its source
3. [ ] Verify that each proposal has a reason and is marked as a proposal, and that no question about a fact has a proposal
4. [ ] Verify that each question has exactly one deciding party (`A`), and that no platform team (`isPlatform: true`) or non-existent team gets `A`/`R`
5. [ ] Verify that the keystone question is surfaced first and dependent questions are marked (`keystoneDependent` / `mootWhen`)
6. [ ] Verify that the default view shows all questions and that each party has one color
7. [ ] Verify that the page contains no requirement, value, or rule that the spec does not contain
8. [ ] Verify in a browser that answers survive the save-and-load round trip (and `validate.mjs && node --test` pass)
9. [ ] Verify that the source spec (`plan.md`) is not altered during page generation
10. [ ] Verify that an anonymised copy passes the forbidden-terms check and has been human-reviewed

Do not proceed until all checks pass.
