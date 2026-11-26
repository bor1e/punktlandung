---
description: "Merge returned stakeholder HTML files or PKL1: answer codes back into spec.md before /speckit.plan"
---

# Punktlandung: Merge Stakeholder Decisions into `spec.md`

Invoked as `/speckit.punktlandung.merge` after stakeholders return saved `.html` copies or `PKL1:...:PKL` reply codes.

## User Input

`$ARGUMENTS` (paths to returned `.html` files, `.txt` email replies, and/or `--code "PKL1:..."` tokens).

## Steps

### 1. Run Conflict-Checked Merge

Run `merge-answers.mjs --copilot-prompt` against the original `open-points.html` and all returned replies:

```bash
node scripts/merge-answers.mjs --copilot-prompt <feature-dir>/clarifications/open-points.html <returned-1.html|reply.txt ...> [--code "PKL1:..."]
```

- If it exits `1` (`Spec mismatch` or invalid `PKL1:` code), stop and show the exact error.
- If it exits `2` (`Conflicts` or stale-option mismatch), do **not** apply conflicting/stale items; ask the human facilitator to resolve them first.

### 2. Apply Only `A`-Decider Decisions to `spec.md`

- Apply every item under **## Resolved Decisions to Apply** to `spec.md` (replace matching `[NEEDS CLARIFICATION: ...]` markers or open bullets with the concrete decided behavior and trace ID).
- Remove or mark **## Moot** items as out of scope.
- **NEVER** apply items under **## Suggested by Non-Deciders (Waiting for Decider — Do NOT Apply Yet)**; list who is still waiting for which decider (`A`).

### 3. Check Completion & Clean Up Ephemeral Files

- If `open > 0` or `conflicts > 0`, rebuild `open-points.html` or chase the remaining `A` decider(s).
- When `open === 0` and `conflicts === 0`, report that `spec.md` is ready for `/speckit.plan` and offer to remove ephemeral `<feature-dir>/clarifications/` (`spec.json`, `*.html`).
