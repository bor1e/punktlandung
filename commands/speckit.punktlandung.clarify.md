---
description: "Turn remaining [NEEDS CLARIFICATION] markers and open points in spec.md into one offline RACI HTML page for non-Git stakeholders"
---

# Punktlandung: Generate Stakeholder Open-Points Page

Triggered automatically after `/speckit.clarify` (via `hooks.after_clarify`) or invoked directly as `/speckit.punktlandung.clarify`.

## User Input

`$ARGUMENTS` (optional path to `spec.md`; if empty, use the active feature's `spec.md` under `specs/*/spec.md`).

## Steps

### 1. Check Whether Any Non-Developer Clarifications Remain

Inspect the target `spec.md` for:
- `[NEEDS CLARIFICATION: ...]` markers
- Unresolved `## Open Questions` / `### Edge Cases` bullets
- Statements that cannot be tested without a business, product, or architecture decision

If **zero** open points remain, tell the user `spec.md` has no remaining open points and is ready for `/speckit.plan`. Stop here.

### 2. Locate Punktlandung Scripts & Config

Check if `.specify/extensions/punktlandung/punktlandung-config.yml` exists (`context_path`, `lang`, `output_dir`, `output_filename`). Defaults:
- `context_path`: `.specify/extensions/punktlandung/context.json` (or an existing `context.json` in the repo)
- `lang`: `en`
- `output_dir`: `<feature-dir>/clarifications`
- `output_filename`: `open-points.html`

Use the installed extension scripts if present under `.specify/extensions/punktlandung/scripts/` (or `./scripts/` inside this repo); otherwise run via `npx github:bor1e/punktlandung#v2.4.0`.

### 3. Scaffold Starter JSON

Run `init-case.mjs` (passing `--context <context_path>` if a team `context.json` already exists):

```bash
node scripts/init-case.mjs <spec.md> --out-dir <feature-dir>/clarifications --lang <lang>
```

### 4. Refine `spec.json` Before Compiling

Update `<feature-dir>/clarifications/spec.json` strictly following `schema/spec.schema.json` and `AGENTS.md`:
- Keep unique topics (`topic || id`) `<= openCount + unprovableCount`.
- Replace placeholder options with **2–4 concrete options** grounded in `spec.md`.
- Set `"proposal": null` on fact questions (formats, naming, external rules); provide `"reason"` whenever `"proposal"` is set.
- Assign **exactly one `"A"` decider** per question; never assign `"A"` or `"R"` to `"isPlatform": true` parties.
- Add `"mootWhen": { "id": "<parent-id>", "eq": "<optionIndex>", "reason": "..." }` for dependent questions.

### 5. Compile & Validate Offline HTML

```bash
node scripts/build.mjs <context.json> <feature-dir>/clarifications/spec.json -o <feature-dir>/clarifications/open-points.html
node scripts/validate.mjs <feature-dir>/clarifications/open-points.html
```

### 6. Hand Off to Stakeholders

Report the generated `open-points.html` path and remind the user:
- Host on SharePoint / Teams Files / Intranet (test in your tenant first) or share directly; send a clean copy to each respondent.
- Stakeholders can either **Save with answers** (`.html`) or click **Copy answer code** (`PKL1:...:PKL`) if `.html` attachments are blocked.
- Once replies return, run `/speckit.punktlandung.merge <replies...>` before `/speckit.plan`.
