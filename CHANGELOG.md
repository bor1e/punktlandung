# History of the idea

Newest entry first. Each entry says what changed and why.

## 2.8.0 (2026-11-26)

Strict standard `init-case` contract and typed comparison cards with build-time image inlining:

- **Strict 3-rule `init-case.mjs` contract:** Removed bespoke German/house-style heuristics (`Offene Stellen`, `TODO(...)`, `**Nicht nachweisbar:**`, `> Version:`) and reverted `init` to one documented standard (`[NEEDS CLARIFICATION: ...]`, `## Open Questions`, `- OQ-1:` / `- Q-1:`). Exits with code `1` and clear guidance when 0 open points match instead of inventing a fake placeholder `Q-1`.
- **Typed `comparison` cards with build-time local image inlining (`schema/spec.schema.json`, `scripts/build.mjs`, `scripts/validate.mjs`, `template/overview.html`):** Strictly typed `comparison.cards[]` (`title`, `summary`, `bullets[]`, `image: { src, alt?, caption? }`, `links[]`, and legacy `wireframeBlock` `bar`/`box` blocks); `build.mjs` automatically inlines local `.png`/`.jpg`/`.webp`/`.gif`/`.svg` paths into `data:image/...;base64,...` so `spec.json` stays clean and diffable while the output HTML remains 100% offline.
- **Kept from `v2.7.0`:** Stale `localStorage` draft protection (`oh` + `specHash`), clickable `links[]`, and optional `parties[].contact`.

## 2.7.0 (2026-11-26)

Real-world German spec extraction, stale `localStorage` draft protection, named contacts, and offline comparison screenshots:

- **Stale `localStorage` draft protection (`template/overview.html`):** Embeds `specHash` and per-question `oh` option hashes in `localStorage` drafts and `#saved`; automatically discards stale draft answers whose question ID or options changed even when `spec.version` was not bumped, and surfaces an explicit warning banner (`staleCleared`) instead of silently carrying over wrong selections.
- **Named party contacts (`schema/context.schema.json`, `scripts/validate.mjs`, `template/overview.html`):** Added optional `parties[].contact` (validated non-empty, rendered cleanly below `role` on `#raci`, omitted in anonymised copies).
- **Offline comparison screenshots (`template/overview.html`, `scripts/validate.mjs`):** Added `{ "type": "img", "src": "data:image/...;base64,...", "alt?", "caption?" }` support in `comparison.cards[].blocks` with validator enforcement forbidding remote image URLs.
- **German & real-spec extraction (`scripts/init-case.mjs`):** Supports `> Version:` blockquote metadata, `Offene Stellen` headings, inline/bullet `TODO(...)` markers, bold `**Nicht nachweisbar:**` / `**Offene Stellen:**` markers (inline or bullet lists), and accurate `openCount` / `unprovableCount` tallies.

## 2.6.0 (2026-11-26)

Clickable external reference links for Figma, Jira, Confluence, GitHub, GitLab, and Azure DevOps:

- **Schema & URL safety (`schema/spec.schema.json`, `scripts/validate.mjs`):** Added optional `links[]` (`{ label, url, kind? }`) to top-level `spec`, `groups[]`, and `questions[]`; restricts `url` to `http://` / `https://` via schema pattern and `new URL(...)` protocol checks.
- **Auto-badged clickable pills (`template/overview.html`):** Auto-detects `Figma`, `Jira`, `Confluence`, `GitHub`, `GitLab`, and `Azure DevOps` URLs (with explicit `kind` override for self-hosted instances), renders safe `target="_blank" rel="noopener noreferrer"` pills in Overview headers, group views, question footers, and a deduplicated `#quellen` Linked Resources section.
- **Markdown link extraction (`scripts/init-case.mjs`):** Extracts `[label](https://...)` links from open-question bullets into `question.links` (keeping question text readable) and from `## Links` / `## References` / `## Sources` sections into `spec.links`.
- **Example, docs & tests (`examples/generic-plan/spec.json`, `skills/open-points-overview/SKILL.md`, `README.md`, `test/punktlandung.test.mjs`):** Documented non-blocking backup-evidence guidance and added validator, template rendering, and `init-case` regression tests.

## 2.5.0 (2026-11-26)

Backwards-compatible decision-governance additions for `context.json` and extraction guardrails inspired by *"Taking Decisions Like a Court"*:

- **Optional `context.json` governance fields (`schema/context.schema.json`):** Added optional `principles` (ordered collision-resolution hierarchy), `defaultRule` (standing burden-of-proof / fallback rule), and `parties[].consultWhen` (mandatory consultation/mandate trigger).
- **Validator enforcement (`scripts/validate.mjs`):** Validates types and non-empty strings when `principles`, `defaultRule`, or `parties[].consultWhen` are present.
- **Responsibilities view (`template/overview.html`):** Renders `principles`, `defaultRule`, and `consultWhen` (properly HTML-escaped) on the `#raci` tab in both DE and EN while keeping question cards untouched.
- **AI extraction guardrails (`skills/open-points-overview/SKILL.md`):** Added disputed-and-relevant filtering, zero-discretion constraint checks, reversibility triage, principle-grounded proposal reasoning, and post-merge dissent / review-trigger guidance.
- **Example & tests (`examples/generic-plan/context.json`, `test/punktlandung.test.mjs`):** Demonstrated the new governance fields in the English example (keeping `examples/steuerbox/context.json` unchanged for backwards compatibility) and added schema validation + `#raci` rendering tests.
- **Nested open-question headings & resolved sections (`scripts/init-case.mjs`):** Tracks heading depth (`openSectionLevel`) so sub-headings (e.g. `### Security` under `## Open Questions`) keep extracting bullets, while standalone `## Decisions` / resolved-decision headings are no longer misclassified as open questions.
- **Full Draft 2020-12 JSON Schema validation (`scripts/validate.mjs`):** Enforces `schema/context.schema.json` and `schema/spec.schema.json` directly inside `validatePayload` (`$ref`, `oneOf`, `anyOf`, `additionalProperties`, `required`, `minItems`/`maxItems`, `pattern`, `enum`, bounds).
- **Latest-wins for corrected replies (`template/overview.html`, `scripts/merge-answers.mjs`):** Embeds an ISO timestamp (`at`) in `PKL1:` answer codes and supersedes earlier answers from the same non-anonymous `(role, respondent)` with a warning instead of raising a false conflict, while keeping disagreements between distinct people as exit-2 conflicts.
- **Documentation accuracy (`README.md`, `docs/index.html`):** Fixed Steuerbox party count (`7 roles`, matching `examples/steuerbox/context.json`).

## 2.4.0 (2026-11-26)

Official GitHub Spec Kit extension integration (`hooks.after_clarify`):

- **Spec Kit extension manifest & config:** Added root `extension.yml` (`schema_version: "1.0"`, `id: "punktlandung"`, `hooks.after_clarify`) and `config-template.yml` so Spec Kit users can install directly via `specify extension add punktlandung --from ...`.
- **Spec Kit slash commands:** Added `commands/speckit.punktlandung.clarify.md` (triggered optionally after `/speckit.clarify` to emit an offline RACI page) and `commands/speckit.punktlandung.merge.md` (merges returned `.html` / `PKL1:` replies back into `spec.md` before `/speckit.plan`).
- **Validation, version sync & tests:** Updated `scripts/validate.mjs`, `scripts/bump-version.sh`, `.githooks/pre-commit`, `package.json`, and `test/punktlandung.test.mjs` to enforce manifest integrity and version sync.

## 2.3.2 (2026-11-26)

Security, resilience, and onboarding hardening from external code audit:

- **Decider-only bulk accept (`template/overview.html`):** `"Accept proposals"` now requires selecting a specific role first and applies only to open questions that role decides (`A`).
- **Wrap-resistant `PKL1:` codes (`template/overview.html`, `scripts/merge-answers.mjs`):** Added `:PKL` closing delimiter, stripped email line wraps and `>` quote prefixes before decoding, and replaced raw stack traces on corrupt codes with clean exit-1 errors.
- **Overwrite guard & multi-marker extraction (`scripts/init-case.mjs`):** Refuses to overwrite existing `spec.json` / `context.json` unless `--force` is passed, and extracts multiple `[NEEDS CLARIFICATION: ...]` markers per line.
- **Strict schema enforcement & standalone validation (`scripts/validate.mjs`):** Enforces hex `#rgb..#rrggbbaa` colors (and escapes colors in template HTML), non-empty string options, `/^[ARCI]+$/` RACI values, and non-negative integer counts; allows `punktlandung validate <file.html>` outside the repo root.
- **Template JS test coverage (`test/punktlandung.test.mjs`):** Added a `node:vm` DOM harness test exercising role-gated bulk accept, `mootWhen` dimming, and `PKL1:` round-trip into `merge-answers.mjs`.
- **Documentation honesty (`README.md`):** Pinned `npx` tag examples, added SharePoint/Outlook tenant testing caveats, and clearly documented fit vs. limits (self-declared roles, 1 file per respondent, author-supplied `openCount`).

## 2.3.1 (2026-11-26)

Bug fixes from external QA:

- **Strict single-decider resolution (`merge-answers.mjs`):** Non-decider (`R`/`C`/`I`) answers are now reported as `suggested (waiting for <decider>)` and never resolve a question or trigger `mootWhen` / keystone muting (`--copilot-prompt` marks them `"Do NOT Apply Yet"`).
- **Option-hash tampering/drift protection (`overview.html`, `merge-answers.mjs`):** Each answer now records an FNV-1a hash (`oh`) of `q.options` and `specVersion`; `merge-answers.mjs` refuses stale answers with exit code `2` if options changed after the reply was sent.
- **Cross-spec refusal (`merge-answers.mjs`):** Merging `.html` or `PKL1:` replies from a different `spec.id` now fails immediately with exit code `1`.
- **Smarter Markdown extraction (`init-case.mjs`):** Extracts plain bullets under `## Open Questions` / `## Clarifications` / `## Decisions` headings and ignores unrelated `US-x` / `FR-x` / `REQ-x` story bullets.
- **Draft placeholder guard (`validate.mjs`, `build.mjs`):** Rejects unedited `init-case.mjs` placeholder options unless `--draft` is passed explicitly.
- **Mergeable email & text replies (`overview.html`):** Appends the `PKL1:` answer code to `summaryText()` and protects the footer from truncation in `mailto:`.

## 2.3.0 (2026-11-26)

Launch & distribution polish:

- **Live GitHub Pages demos & visual preview:** Added `docs/index.html`, `.github/workflows/pages.yml`, and `docs/preview.png` so anyone can test all 4 examples live in the browser before cloning.
- **Zero-attachment `PKL1:` paste-back code:** Added 1-click **Copy answer code** (`PKL1:<base64url>`) in `template/overview.html` and `--code` / `.txt` extraction in `scripts/merge-answers.mjs` so replies work even when corporate Outlook blocks `.html` attachments.
- **Zero-dependency `npx` CLI:** Added `package.json` (`dependencies: {}`, `bin.punktlandung`) and `scripts/cli.mjs` (`npx github:bor1e/punktlandung init|build|merge|validate`), with `package.json` version synced in `validate.mjs` and `bump-version.sh`.
- **Cross-agent adoption pack:** Added `AGENTS.md`, `CLAUDE.md`, and `.github/prompts/clarify-plan.prompt.md`, and reframed `README.md` around **"Multiplayer `/clarify` for non-Git stakeholders"** with the English Spec Kit example featured first.

## 2.2.0 (2026-11-26)

Hardened from a 5-perspective adversarial review (Spec Kit, OpenSpec, Copilot, Over-Engineering, and Business Ops):

- **Scaffolding & Copilot support:** Added `scripts/init-case.mjs` (extracts `[NEEDS CLARIFICATION]`, tagged `OQ-x`/`Q-x`/`U-x`, or `- [ ]` items from any Markdown spec + generates a default `context.json`), `.github/copilot-instructions.md`, and `merge-answers.mjs --copilot-prompt`.
- **Concrete Spec Kit & OpenSpec examples:** Added `examples/speckit-sso/` (5 `[NEEDS CLARIFICATION]` markers, 2 `mootWhen` branches) and `examples/openspec-webhooks/` (brownfield delta proposal), both reusing `examples/generic-plan/context.json`, plus `examples/README.md`.
- **Real bug fixes:** Made `extractJsonIsland` attribute-order independent, fixed `scripts/build.mjs` template path resolution outside repo root, added role-selection reminder before saving, and added 1-click **Copy reply text** + **Send via email** (`mailto:`) fallbacks for Outlook/mobile readers.
- **Automated tests & CI/CD badges:** Added zero-dependency `test/punktlandung.test.mjs` (`node --test`), reproducible build checks across all 4 examples in `ci.yml`, automatic GitHub Release creation in `version-bump.yml`, and README status/tag/license badges + Start-to-End ASCII workflow diagrams.

## 2.1.0 (2026-11-26)

Adopted the best ideas from SurveyJS, TiddlyWiki, Spec Kit, and OpenSpec without adding any runtime dependencies:

- **Formal JSON Schemas:** Added `schema/context.schema.json` and `schema/spec.schema.json` (Draft 2020-12) referenced by all examples and checked by `scripts/validate.mjs`.
- **Declarative per-question branching (`mootWhen`):** SurveyJS-style conditional dimming (`{ id, eq | neq, reason }`) supported in `template/overview.html`, `scripts/validate.mjs`, and `scripts/merge-answers.mjs` alongside legacy `keystoneDependent`.
- **TiddlyWiki-style saver UX:** Added unsaved-change indicator dot, `beforeunload` tab-close guard, and `window.showSaveFilePicker` save-in-place with seamless Blob download fallback.
- **Spec Kit & OpenSpec bridge:** Documented upstream `[NEEDS CLARIFICATION]` / `openspec/changes/<feature>/` integration in `README.md` and `SKILL.md`, and replaced all local paths with relative links for public GitHub release.

## 2.0.0 (2026-11-26)

Generalization from a single hardcoded German HTML example into a reusable, open-source **two-layer clarification compiler** for any `plan.md` or feature spec.

- **Two-layer separation (`context.json` + `spec.json`):** Team roles, colors, platform flags, and environment constraints live once in `context.json` (analogous to arc42 §1–2); per-feature open points live in compact `spec.json`.
- **Generic DE/EN engine (`template/overview.html`):** Zero-dependency single-file HTML template driven purely by `#spec-data` JSON, with optional use-case scenarios, declarative keystone muting (`keystone.mootOption`), role-sync navigation, and one-click AI-Bot JSON export.
- **Compiler & answer merger (`scripts/build.mjs`, `scripts/merge-answers.mjs`):** Compile `context.json` + `spec.json` into a validated offline HTML file, and merge N returned HTML copies by `A`-decider authority with conflict detection into a Markdown/JSON patch for `plan.md`.
- **Generic `plan.md` example (`examples/generic-plan/`):** Domain-neutral English walkthrough without use-case tables.
- **Zero-loss Steuerbox rebuild (`examples/steuerbox/`):** Extracted `context.json` + `spec.json` verbatim from `v1.0.0:example.html` and verified 100% content parity.
- **Open-source readiness:** Added MIT `LICENSE`, updated `SKILL.md` (`2.0.0`), and documented comparison with `arc42`/`req42`, `MADR`, `Spec Kit`/`OpenSpec`, and `TiddlyWiki`.

## 1.0.0 / Second version (2026-11-26)

The first reader was the person who asked for the page. These were the remarks.

| Remark | What was wrong | Change |
|---|---|---|
| "I would like to have the total overview, without a specific perspective." | The page opened on the view of one role. Nobody saw the whole. | The default view shows everything. A role is a filter. |
| "Do not subdivide the overview, use different colours." | The role decided which page a reader got. | Each party has one colour: on the question, in the filters, in the matrix. |
| "These three parties seem to be the same." | The matrix copied the stakeholder table of the ticket. The reader saw three of its rows as one department. | Parties that the reader sees as one are one party. The highest letter of the three wins. |
| "It seems that we have more questions than before." | 22 open points and 5 unprovable statements had become a flat list of 40 questions. The work was the same, but it looked like more. | 25 topics with sub-questions. The page explains its numbers and shows that 35 of 40 have a proposal. |
| "That team is the central platform team, not the project team." | The role of a team was guessed from its name, and it got requirement questions. | A platform team gets no requirement question. It is consulted only where the build or the deployment changes. |
| "The requirements are implemented by an AI after the architect releases them, not by a developer team." | Questions about feasibility and built behaviour were assigned to a team that does not exist. | No question goes to a development team. The code answers these questions. |
| "I am not sure that the implementation concept should be part of the page." | The page started to explain the process around it. | The page keeps one purpose. The process is written in the project documentation. |
| "Anonymise the view, so that it can be shared publicly." | - | A script makes the public copy and stops when an identifying term is left. |

## First version (2026-11-26)

- One HTML file with the open points of the spec as closed questions: options, "other" with a text field, a note.
- A recommendation with a reason for each question that is not a question about a fact.
- Four use cases as the reading order, with the scenario rows of the spec.
- A RACI matrix with exactly one deciding party for each question.
- The keystone question (which of two designs applies) at the top. The questions that depend on it are greyed out when the answer removes them.
- Answers are saved as a draft in the browser and can be downloaded inside a copy of the page.
