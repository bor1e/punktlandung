# Punktlandung — Open Points Overview

**Turn the open points of any `plan.md` or feature spec into one offline, self-saving HTML page where every stakeholder sees the whole picture, filters to their decisions, and sends answers back — before an AI or team starts building.**

```
context.json (define once: team, RACI roles, colors, constraints)
        +
plan.md / feature spec ──▶ spec.json (only this feature's open points)
        │
        ▼  node scripts/build.mjs
open-points.html (1 offline file — email / Slack / SharePoint, zero server)
        │
        ▼  stakeholders click answers + "Save with answers"
returned-*.html
        │
        ▼  node scripts/merge-answers.mjs
Decision Patch (Markdown / JSON) ──▶ update plan.md ──▶ AI implements cleanly
```

## Why this exists

A spec with open points cannot be implemented cleanly. When a human developer hits a gap, they walk over and ask a colleague. When **an AI coding agent implements an approved `plan.md`**, gaps turn into silent assumptions — or hallucinated scope.

The usual fix is a string of meetings, email threads, and scattered comments across Jira, Figma, and Confluence. **Punktlandung** replaces those meetings with one self-contained HTML file:

- **One shared overview first.** Every reader sees the full scope; a role is just a color-coded filter.
- **Closed questions with reasoned proposals.** Each open point has 2–4 concrete options, a reasoned proposal (never guessed for missing facts), and an `"Other"` text field.
- **Exactly one deciding party (`A`) per question.** Built on a reusable `context.json` so you define your team, colors, and constraints once — just like `arc42` §1–2 — and reuse them across every `plan.md`.
- **Keystone dependencies.** Answer the big conceptual fork first; dependent questions automatically grey out if they become moot.
- **Zero-backend round-trip.** Readers save a self-contained HTML copy with their answers embedded (`#saved`) or copy a plain-text / AI-ready JSON summary. `merge-answers.mjs` reconciles multiple returned copies and flags conflicts.

---

## 60-Second Quickstart

Requires **Node.js 20+** (zero npm packages needed).

```bash
# 1. Build the minimal generic plan.md example (English)
node scripts/build.mjs \
  examples/generic-plan/context.json \
  examples/generic-plan/spec.json \
  -o examples/generic-plan/open-points.html

# 2. Validate repo sync and both generated HTML files
node scripts/validate.mjs

# 3. Merge returned HTML copies into a Markdown/JSON patch for your AI agent
node scripts/merge-answers.mjs returned-biz.html returned-arch.html
```

Open [examples/generic-plan/open-points.html](file:///Users/elyahuborodin/Documents/projects/punktlandung/examples/generic-plan/open-points.html) (generic `plan.md` example, English) or [example.html](file:///Users/elyahuborodin/Documents/projects/punktlandung/example.html) (real-world anonymised case study, German) directly in any browser — no server or internet connection needed.

---

## Repository Layout

| Path | What it is |
|---|---|
| `template/overview.html` | Generic, zero-dependency DE/EN HTML engine (`#spec-data` + `#saved` JSON islands). |
| `scripts/build.mjs` | Compiles `context.json` + `spec.json` + template into one offline HTML file and validates invariants. |
| `scripts/merge-answers.mjs` | Reconciles 1..N returned HTML files by `A`-decider authority, flags conflicts, emits Markdown or `--json`. |
| `scripts/validate.mjs` | Validates SemVer sync (`VERSION` ↔ `SKILL.md`), zero external URLs, RACI rules, topic limits, and dependencies. |
| `examples/generic-plan/` | Minimal `plan.md` → `context.json` + `spec.json` → `open-points.html` workflow (English). |
| `examples/steuerbox/` | Real-world anonymised feature-set (`context.json` + `spec.json`) that builds root `example.html` (German). |
| `skills/open-points-overview/SKILL.md` | Agent skill teaching any AI coding assistant how to extract `spec.json` from a `plan.md` or spec. |
| `scripts/bump-version.sh`, `.githooks/`, `.github/workflows/` | Automated SemVer bumping, local pre-commit validation, and CI checks. |

---

## How Does This Compare to Existing Open-Source Tools?

| Tool | Primary strength | Where the gap remains (what Punktlandung solves) |
|---|---|---|
| **[arc42](https://arc42.org/) / [req42](https://req42.de/)** | Proven Markdown/AsciiDoc templates for architecture, stakeholders, and open points. | Static docs: non-technical business stakeholders don't click answers in Git or export structured decisions back. |
| **[MADR](https://adr.github.io/madr/)** | Clean Markdown Architecture Decision Records once a decision is made. | Captures decisions *after* alignment; doesn't run the asynchronous multi-role clarification loop beforehand. |
| **[GitHub Spec Kit](https://github.com/github/spec-kit) / [OpenSpec](https://github.com/Fission-AI/OpenSpec)** | Spec-driven AI workflows (`/speckit.clarify`, delta specs) inside developer repositories. | Terminal/IDE-first: great for devs + AI, inaccessible to business/compliance departments who only open email/HTML. |
| **[TiddlyWiki](https://tiddlywiki.com/)** | Pioneered self-saving single-file HTML. | General-purpose wiki runtime (~2 MB), not a RACI-enforced spec-clarification protocol. |
| **Punktlandung** | **Two-layer bridge (`context.json` + `spec.json` → single offline HTML → `merge-answers.mjs`)** | Connects non-technical stakeholders directly to `plan.md` and AI coding agents in zero-infra environments. |

Punktlandung pairs naturally with **Spec Kit / OpenSpec** upstream (turn `[NEEDS CLARIFICATION]` markers into `spec.json`) and **MADR** downstream (archive settled decisions as ADRs).

---

## The 10 Mindset Principles

1. **Add nothing.** The page is a reading version of the spec. Proposals are marked as proposals; nothing on the page is a requirement unless the spec states it.
2. **Find the keystone question.** Ask the question that removes or creates other questions first.
3. **A closed question is a kindness.** *"How should the filter behave?"* starts a meeting. *"A: inclusive (proposal). B: exclusive."* takes ten seconds.
4. **Recommend where you can. Do not guess facts.** Reasoned proposals make confirmation cheap; guessed facts make specs wrong.
5. **Do not inflate the count.** Split multi-part open points into sub-questions under one topic (`topics <= openCount + unprovableCount`).
6. **One party decides.** A question with two `A`s has no owner. Define teams once in `context.json`; keep platform teams out of product questions.
7. **Show the whole, color the parts.** Separate documents per role hide context; one shared page with color-coded role filters preserves it.
8. **Answers must travel.** Static exports create meetings; self-contained `#saved` HTML + `merge-answers.mjs` close the loop.
9. **Keep the page to one purpose.** Process documentation belongs in the repo, not inside the questionnaire.
10. **Keep the spec's IDs intact.** Readers think in goals/groups; tests and AI bots need spec IDs (`ref`) as the trace.

---

## Real-World Case Study (`examples/steuerbox/`)

The anonymised German example ([example.html](file:///Users/elyahuborodin/Documents/projects/punktlandung/example.html)) comes from a real feature spec (*Steuerbox* control actions): 22 open points + 5 unprovable statements → 25 topics, 40 sub-questions, 35 reasoned proposals, 5 fact questions. Of the 40 sub-questions, Product Owner decides 21, Architect 10, and Business (*Fachbereich*) 9 — immediately showing Business that only 9 decisions are theirs.

<details>
<summary>Domain glossary for the German Steuerbox example</summary>

| Term | Meaning |
|---|---|
| Steuerbox | Control box at a customer's power plant used by the grid operator to curtail output. |
| FRE | Older ripple-control receiver (`Funkrundsteuerempfänger`) for the same purpose. |
| Steuerhandlung | One control action (curtailment level or release). |
| Steuergruppe | Group of plants controlled together. |
| Fachbereich | The business department. |

</details>

---

## Versioning, Validation & License

- **License:** [MIT](file:///Users/elyahuborodin/Documents/projects/punktlandung/LICENSE)
- **Version sync:** [VERSION](file:///Users/elyahuborodin/Documents/projects/punktlandung/VERSION) and [SKILL.md](file:///Users/elyahuborodin/Documents/projects/punktlandung/skills/open-points-overview/SKILL.md) (`version:`) stay in sync.
- **Validate:** `node scripts/validate.mjs`
- **Manual bump:** `./scripts/bump-version.sh [patch|minor|major] [--commit] [--tag]`
- **Automation:** `.githooks/pre-commit` (`git config core.hooksPath .githooks`) auto-bumps `patch` on content commits when `VERSION` is not already staged; `.github/workflows/version-bump.yml` handles commit-driven bumps and `v*` tags on `main`.
