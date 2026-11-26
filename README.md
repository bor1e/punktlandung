# Open points overview

**One HTML file that turns the open points of a spec into questions that people can answer with a click, and that tells each reader which questions are theirs.**

A spec with open points cannot be implemented. The usual way to close them is a series of meetings and mail threads. This idea replaces that with one page: each open point is a closed question with options and a recommendation, each question has one party that decides, and the answers travel back inside the file.

This folder contains the idea, a real example in anonymised form, and the method as a skill for an AI coding assistant.

| File | What it is |
|---|---|
| `README.md` | This text: the problem, the requirement, the mindset. |
| `example.html` | The example page. Open it in a browser. No server and no connection are necessary. The page is in German. |
| `skills/open-points-overview/SKILL.md` | The method as steps and a checklist. An AI assistant can follow it to build such a page from a spec. |
| `CHANGELOG.md` | How the idea changed from the first version to the second, and why. |
| `VERSION` | Current SemVer version of the repository and skill. |
| `scripts/validate.mjs` | Zero-dependency validator for version sync and HTML overview invariants. |
| `scripts/bump-version.sh` | SemVer bump script (`patch`/`minor`/`major`/`--from-commits`) with optional `--commit` and `--tag`. |
| `.githooks/pre-commit` | Local hook that auto-bumps `patch` on content changes and runs validation. |
| `.github/workflows/` | CI validation (`ci.yml`) and automatic version bump/tagging on `main` (`version-bump.yml`). |

## The problem

A requirements document for a small feature (show the control actions of a new device type in an application that exists) had 22 open points and 5 statements that no test could prove. The causes were ordinary:

- Two designs with different concepts existed, and no source said which one applied.
- Facts were missing: a data format, a naming rule, a delivery interval.
- Decisions from design comments were half made: a proposal, an objection, no conclusion.
- The application had behaviour that no requirement described.

The people who could close these points were in six different roles. Each of them could answer a part, and nobody could see which part.

There was one more reason to close the points before the work started. In this project **an AI implements the spec after the architect releases it**. A developer who finds a gap asks a colleague. An AI that finds a gap does not build the item, or it makes an assumption and builds that. The spec is the complete input, so the gaps must be closed before the release, not during the implementation.

## The requirement

This is what the page had to do. The first six points are the initial request. The others came from the review of the first version.

1. Give the business department one overview, as one HTML file.
2. For each open question, let the reader choose between answers, or select "other" and type an answer.
3. Save the answers in the HTML file, if that is possible.
4. Check if use cases and scenarios are a better structure for readers than features.
5. Show a RACI-type matrix: which questions go to the business department, which can the product owner decide, which does the architect answer, which other parties are involved.
6. The goal is a requirements document without many new open questions.
7. Show the total overview without a perspective. Do not divide the page by role: use colours.
8. Parties that the reader sees as the same are one party.
9. The page must not have more questions than the spec had.
10. A copy can be shared publicly: no company, no names, no specific data, but the problem stays visible.
11. The page only shows the open questions and leads each reader to the right party. It does not describe the process around it.

## What the page does

- **It shows everything first.** The default view has no perspective. A role is a filter.
- **It gives each party one colour.** A filled chip means "decides". A chip with a border means "supplies the answer". The left border of a question has the colour of the party that decides.
- **It makes each question closed.** Two to four options, "other" with a text field, an optional note. The context says what the sources say.
- **It recommends.** One option is marked as the proposal, with a reason. A question about a fact has no proposal: only the party that owns the fact knows the answer.
- **It puts the keystone question first.** One question (which design applies) decides if 14 others exist. When the reader selects the other design, these 14 are greyed out.
- **It brings the answers back.** A button downloads a copy of the page that contains the answers. The reader sends this copy. The browser also keeps a draft.
- **It is honest about its numbers.** The example shows 25 topics, 40 sub-questions, 35 with a proposal, and it explains how these relate to the numbers of the spec.

In the example, the product owner decides 21 sub-questions, the architect 10 and the business department 9. The business department sees that 9 of 40 are its decisions, not 40.

## The mindset

1. **Add nothing.** The page is a reading version of the spec. An option is a proposal and is marked as one. Nothing on the page is a requirement that the spec does not contain.
2. **Find the keystone question.** Before you write a question, look for the one whose answer removes or creates others. Ask it first.
3. **A closed question is a kindness.** "How should the filter behave?" starts a meeting. "A: the limit days are included (proposal, because a reader understands 'from ... to' this way). B: they are not." takes ten seconds.
4. **Recommend where you can. Do not guess facts.** A recommendation with a reason makes confirmation cheap. A guessed fact makes the document wrong.
5. **Do not make the list longer than the spec.** If one open point contains three questions, show one topic with three sub-questions. The reader counts topics.
6. **One party decides.** A question with two deciding parties has none. Merge parties that the reader sees as one. Ask who is who: do not guess the role of a team from its name.
7. **Show the whole, colour the parts.** A page divided by perspective hides the overview that each reader needs. A filter gives the perspective without this cost.
8. **The answers must travel.** A page that cannot return answers makes the meeting necessary again.
9. **Keep the page to one purpose.** The page shows open points and leads each to its party. The process around it (who releases, who implements, how versions work) is written in the project documentation.
10. **Do not change the structure of the spec for the page.** Readers think in use cases. Tests need features with IDs. The page uses use cases as its reading order and shows the IDs of the spec as the trace.

## How to use it

To see the idea: open `example.html`, select an option on some questions, then select "Mit Antworten speichern". The downloaded file contains your answers.

To make such a page for a different spec: give `skills/open-points-overview/SKILL.md` to an AI coding assistant together with the spec, and tell it to follow the skill. Use `example.html` as the pattern for the layout and the behaviour.

To use the page with real readers:

1. Send the file. Tell each reader their role.
2. Each reader answers their questions and sends the saved copy back.
3. Each answer changes the spec: an open point becomes a scenario, or a decision moves it out of scope. That is a new version of the spec.
4. Build the page again from the new spec. When the page is empty, the spec can be released.

## What the example keeps and what it hides

The example is a real case. Company, departments, persons, ticket numbers, comment IDs, links, the design picture, place names and file names are removed or replaced. The domain terms, the questions, the options and the proposals are the original ones, so the problem stays visible. The page text is German.

Some terms of the domain, for readers who do not know it:

| Term | Meaning |
|---|---|
| Steuerbox | A control box at a power plant of a customer. The grid operator uses it to reduce the output of the plant. |
| FRE | The older device for the same purpose (a ripple control receiver). |
| Steuerhandlung | One control action: a reduction to a level, or a release. |
| Steuergruppe | A group of plants that are controlled together. |
| Fachbereich | The business department. |

## Status and limits

- The method was used one time, for this example. The skill has no automatic test.
- The assignment of questions to parties in the example is a proposal. No source defined it.
- The download of the page with answers was tested. The draft in the browser was tested with a simulated storage only.
- No licence is given yet.

## Versioning & validation

- `VERSION` and `skills/open-points-overview/SKILL.md` (`version:`) stay in sync.
- Run `node scripts/validate.mjs` to verify version sync and `example.html` invariants.
- Run `./scripts/bump-version.sh [patch|minor|major] [--commit] [--tag]` for manual bumps.
- Local `.githooks/pre-commit` (`git config core.hooksPath .githooks`) auto-bumps `patch` when content files are committed without an explicit `VERSION` edit; `.github/workflows/version-bump.yml` handles commit-driven bumps and `v*` tags on `main` without double-bumping.
