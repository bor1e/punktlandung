# Agent Instructions — Punktlandung

**Multiplayer `/clarify` for non-Git stakeholders.** Use this repository to turn open points in any `plan.md`, GitHub Spec Kit `spec.md`, or OpenSpec `proposal.md` into one offline HTML page where each party selects answers and sends them back (via saved `.html` or `PKL1:` paste-back code).

## Two-Layer Model
1. **Team Context (`context.json`, defined once per team):** Roles, colors, `isPlatform` guards, language (`de`/`en`), and environment constraints (`schema/context.schema.json`). Reuse an existing `context.json` across specs.
2. **Feature Spec (`spec.json`, per `plan.md` / feature):** Closed questions, options, reasoned proposals, RACI assignments, and declarative `mootWhen` branching (`schema/spec.schema.json`).

## Commands
- Scaffold starter JSON from Markdown:
  `node scripts/init-case.mjs <plan.md|spec.md|proposal.md> [--context <context.json>] [--out-dir <dir>]`
- Compile & validate offline HTML:
  `node scripts/build.mjs <context.json> <spec.json> -o <open-points.html>`
- Merge returned `.html` files and/or `PKL1:` codes into an AI-ready patch:
  `node scripts/merge-answers.mjs [--json|--copilot-prompt] <file-or-reply.html|.txt> [--code "PKL1:..."]`
- Validate & run tests:
  `node scripts/validate.mjs && node --test`

## Non-Negotiable Rules (Full Protocol: `skills/open-points-overview/SKILL.md`)
1. **Topic budget:** Unique topics (`topic || id`) must not exceed `openCount + unprovableCount` of the source spec.
2. **Closed questions:** 2–4 concrete options per question, grounded in named sources. Never invent requirements.
3. **Facts vs. proposals:** Set `"proposal": null` on fact questions (formats, external rules, naming); include `"reason"` whenever `"proposal"` is set.
4. **Single decider:** Exactly one `"A"` party per question. Parties with `"isPlatform": true` must NEVER have `"A"` or `"R"`.
5. **Conditional dimming:** Use `"mootWhen": { "id": "<parent-id>", "eq": "<optionIndex>", "reason": "..." }` for dependent questions.
6. **Lifecycle boundary:** Answers update `plan.md` / `spec.md` / `proposal.md` — never the compiled HTML. Discard or archive ephemeral `spec.json` / `*.html` once `open === 0`.
