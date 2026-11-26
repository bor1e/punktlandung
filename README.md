# Punktlandung — Open Points Overview

[![CI](https://github.com/bor1e/punktlandung/actions/workflows/ci.yml/badge.svg)](https://github.com/bor1e/punktlandung/actions/workflows/ci.yml)
[![Version Bump](https://github.com/bor1e/punktlandung/actions/workflows/version-bump.yml/badge.svg)](https://github.com/bor1e/punktlandung/actions/workflows/version-bump.yml)
[![Latest Tag](https://img.shields.io/github/v/tag/bor1e/punktlandung?label=version)](https://github.com/bor1e/punktlandung/tags)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Zero Dependencies](https://img.shields.io/badge/dependencies-0-brightgreen.svg)](scripts/build.mjs)

**Turn open points in any `plan.md`, Epic, Spec Kit `spec.md`, or OpenSpec `proposal.md` into one offline HTML page where every stakeholder sees the whole picture, filters to their decisions, and sends answers back — before an AI or team starts building.**

---

## Where We Start, Where We End

### 1. Where Punktlandung Fits in Your Delivery Lifecycle

```text
  DEFINE        PLAN          CLARIFY          BUILD         VERIFY        SHIP
┌────────┐   ┌────────┐   ╔════════════╗   ┌────────┐   ┌────────┐   ┌────────┐
│  Idea  │   │  Spec  │   ║ Open Pts & ║   │  Code  │   │  Test  │   │   Go   │
│ Refine │──▶│  PRD   │──▶║   RACI     ║──▶│  Impl  │──▶│  Debug │──▶│  Live  │
└────────┘   └────────┘   ╚════════════╝   └────────┘   └────────┘   └────────┘
  /spec        /plan      ▲ PUNKTLANDUNG    /build        /test        /ship
                          │
                          └─ Starts: spec has open points
                             Ends:   0 open points (ready to implement)
```

### 2. Inside Punktlandung — Start to End

```text
  START             EXTRACT           COMPILE           DECIDE             END
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│ plan.md  │     │  Closed  │     │  Single  │     │  Click   │     │ Decision │
│ + Team   │────▶│ Questions│────▶│   HTML   │────▶│  & Save  │────▶│  Patch   │
└──────────┘     └──────────┘     └──────────┘     └──────────┘     └──────────┘
context.json     init-case.mjs     build.mjs       offline file    merge-answers.mjs
 (define once)    + AI / SKILL    (validated)     (or Copy/Mail)   (update plan.md)
```

- **Start:** A `plan.md` / `spec.md` / `proposal.md` with open questions + your reusable team `context.json`.
- **End:** `merge-answers.mjs` outputs a conflict-checked patch (Markdown, JSON, or `--copilot-prompt`), you update `plan.md`, and when `open === 0`, the ephemeral `.html` / `spec.json` files are done.

> **When NOT to use Punktlandung:** If all your stakeholders already review GitHub Pull Requests directly, use GitHub PRs/Issues! Punktlandung exists for the gap where **business, legal, operations, or domain experts sit outside Git**.

---

## Start a New Case in 3 Steps

Requires **Node.js 20+** (zero npm packages needed).

```bash
# Step 1 — Scaffold spec.json (+ a reusable context.json if you don't have one yet)
node scripts/init-case.mjs path/to/plan.md --out-dir my-case

# Step 2 — Refine options, proposals, and RACI (yourself or via AI using SKILL.md / .github/copilot-instructions.md),
#          then compile one offline HTML file:
node scripts/build.mjs my-case/context.json my-case/spec.json -o my-case/open-points.html

# Step 3 — Share open-points.html (SharePoint/Intranet link or email; readers can Save with answers OR Copy reply / Send via email),
#          then merge returned copies into an AI-ready patch:
node scripts/merge-answers.mjs --copilot-prompt returned-biz.html returned-arch.html
```

**Corporate email tip:** If Outlook/Exchange quarantines `.html` attachments, host the single file on SharePoint/Intranet/Teams Files, or tell readers to use the built-in **"Copy reply text"** / **"Send via email"** buttons — no file attachment required on the return trip.

---

## Examples (`examples/`)

See [examples/README.md](examples/README.md) for the full index. Notice that the first three examples **reuse the exact same `context.json`** (`examples/generic-plan/context.json`):

| Example | Source Input | Language | Highlights |
|---|---|---|---|
| [`examples/generic-plan/`](examples/generic-plan/) | `plan.md` | EN | Minimal `plan.md` (4 Qs, 1 `mootWhen` branch) → [open-points.html](examples/generic-plan/open-points.html) |
| [`examples/speckit-sso/`](examples/speckit-sso/) | GitHub Spec Kit `spec.md` | EN | `[NEEDS CLARIFICATION]` markers, 2 `mootWhen` branches, reused `context.json` → [open-points.html](examples/speckit-sso/open-points.html) |
| [`examples/openspec-webhooks/`](examples/openspec-webhooks/) | OpenSpec `proposal.md` | EN | Brownfield delta sign-off before `/opsx:apply`, `PLAT: C`, reused `context.json` → [open-points.html](examples/openspec-webhooks/open-points.html) |
| [`examples/steuerbox/`](examples/steuerbox/) | Anonymised enterprise spec | DE | Real-world case: 4 Use Cases, 26 scenarios, 25 topics, 40 Qs → [example.html](example.html) |

---

## How Does This Differ From `arc42`, `req42`, `Spec Kit`, `OpenSpec`, and Business Tools?

### For Engineering & Architecture Teams
| Tool | What it already solves | What Punktlandung adds (without replacing it) |
|---|---|---|
| **[arc42](https://arc42.org/) / [req42](https://req42.de/)** | Proven templates for architecture (`arc42`) and agile requirements (`req42`, including stakeholder lists & open points). | `arc42`/`req42` are static docs in Git/AsciiDoc. Punktlandung is the **interactive round-trip compiler** for the open-points section: closed options, one `A` decider per question, and answers embedded back into the file. |
| **[MADR](https://adr.github.io/madr/)** | Recording Architecture Decision Records *after* a decision is reached. | Punktlandung runs the async clarification loop *before* an ADR or spec update is written. |
| **[GitHub Spec Kit](https://github.com/github/spec-kit) / [OpenSpec](https://github.com/Fission-AI/OpenSpec)** | Developer + AI spec workflows (`/speckit.clarify`, `openspec/changes/`). | Terminal/IDE-first. Punktlandung gives non-Git stakeholders an offline HTML frontend for `[NEEDS CLARIFICATION]` / `proposal.md` gates, then feeds decisions back via `--copilot-prompt`. |
| **[TiddlyWiki](https://tiddlywiki.com/)** | Self-saving single-file HTML. | Borrowed its dirty-state guard + `showSaveFilePicker` UX in ~30 lines without a 2 MB wiki runtime. |
| **[SurveyJS](https://surveyjs.io/)** | Schema-driven forms + `visibleIf`. | Borrowed formal JSON Schemas + `mootWhen` branching at 0 KB dependency cost. |

### For Business & Product Stakeholders
| Alternative | Why it stalls | Why Punktlandung works |
|---|---|---|
| **60-minute alignment meeting** | 6 people wait while 2 debate one question; decisions aren't written down. | Everyone sees only *their* colored decisions (`A`), with 2–4 concrete options and a pre-written proposal. |
| **Email threads / Confluence comments** | Replies scatter across 12 threads; nobody knows who has final say. | One file, one `A` decider per question, conflict detection in `merge-answers.mjs`. |
| **MS / Google Forms** | Requires SaaS accounts/hosting, loses architectural context, breaks offline, doesn't export back into Git/AI prompts. | Zero server, zero login, stays inside your repo/intranet, exports Markdown/JSON/Copilot prompts directly. |

---

## Repository Layout

| Path | What it is |
|---|---|
| [template/overview.html](template/overview.html) | Generic, zero-dependency DE/EN HTML engine (`#spec-data` + `#saved`, `mootWhen`, TiddlyWiki saver UX, Copy/Mail fallback). |
| [schema/context.schema.json](schema/context.schema.json) | Draft 2020-12 JSON Schema for reusable team context (`parties`, colors, `isPlatform`, constraints). |
| [schema/spec.schema.json](schema/spec.schema.json) | Draft 2020-12 JSON Schema for per-`plan.md` specs and `mootWhen` rules. |
| [scripts/init-case.mjs](scripts/init-case.mjs) | Scaffolds `spec.json` (+ default `context.json`) from any `plan.md`, Spec Kit `spec.md`, or OpenSpec `proposal.md`. |
| [scripts/build.mjs](scripts/build.mjs) | Compiles `context.json` + `spec.json` + template into one validated offline HTML file (works from any `cwd`). |
| [scripts/merge-answers.mjs](scripts/merge-answers.mjs) | Merges 1..N returned HTML copies by `A`-decider authority (`--json`, `--copilot-prompt`, or Markdown). |
| [scripts/validate.mjs](scripts/validate.mjs) | Validates SemVer sync (`VERSION` ↔ `SKILL.md`), JSON Schemas, zero external URLs, RACI rules, topic limits, and `mootWhen`. |
| [test/punktlandung.test.mjs](test/punktlandung.test.mjs) | Zero-dependency `node --test` suite covering extraction, validation, building, scaffolding, and answer merging. |
| [skills/open-points-overview/SKILL.md](skills/open-points-overview/SKILL.md) | Agent skill for AI assistants; [.github/copilot-instructions.md](.github/copilot-instructions.md) for GitHub Copilot. |
| [scripts/bump-version.sh](scripts/bump-version.sh), [.githooks/](.githooks/), [.github/workflows/](.github/workflows/) | Automated SemVer bumping, pre-commit validation, CI test/build checks, and GitHub Release tagging. |

---

## The 10 Mindset Principles

1. **Add nothing.** Proposals are marked as proposals; nothing on the page is a requirement unless the spec states it.
2. **Find the keystone question.** Ask the question that removes or creates other questions first (`mootWhen`).
3. **A closed question is a kindness.** 2–4 concrete options take 10 seconds; open-ended *"How should this work?"* starts a meeting.
4. **Recommend where you can. Do not guess facts.** Reasoned proposals make confirmation cheap; guessed facts make specs wrong.
5. **Do not inflate the count.** Split multi-part open points into sub-questions under one topic (`topics <= openCount + unprovableCount`).
6. **One party decides.** Exactly one `A` per question. Define teams once in `context.json`; keep platform teams out of product questions.
7. **Show the whole, color the parts.** One shared page with color-coded role filters preserves cross-team context.
8. **Answers must travel.** `#saved` HTML + Copy/Mail fallback + `merge-answers.mjs` close the loop without a backend.
9. **Keep the page to one purpose.** Process documentation belongs in `README.md`, not inside the questionnaire.
10. **Keep the spec's IDs intact.** Readers think in goals/groups; tests and AI bots need spec IDs (`ref`) as the trace.

---

## License, Attribution & Liability

This project is released under the **[MIT License](LICENSE)**:
- **Free to use, copy, modify, and distribute** (commercially or privately).
- **Attribution / quote required:** Copies or substantial portions of the software must keep the copyright and MIT permission notice (`Copyright (c) 2026 Elyahu Borodin`).
- **No warranty, no liability:** Provided *"AS IS"*, without warranty or liability of any kind.

*(Note: If you adapt the written prose/methodology separately from code in a book or course, standard MIT notice or crediting the repository URL fulfills attribution.)*

---

## Versioning & CI/CD

- **Validate & test locally:** `node scripts/validate.mjs && node --test`
- **Version sync:** [VERSION](VERSION) and [SKILL.md](skills/open-points-overview/SKILL.md) (`version:`) stay in sync.
- **Manual bump:** `./scripts/bump-version.sh [patch|minor|major] [--commit] [--tag]`
- **Automated CI/CD:** [.github/workflows/ci.yml](.github/workflows/ci.yml) runs validation, `node --test`, and reproducible build diffs on every push/PR; [.github/workflows/version-bump.yml](.github/workflows/version-bump.yml) auto-bumps from conventional commits on `main`, pushes `v*` tags, and publishes GitHub Releases.
