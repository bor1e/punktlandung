# Examples

All four examples compile with `scripts/build.mjs` and are validated on every CI run. Notice that `generic-plan`, `speckit-sso`, and `openspec-webhooks` all **reuse the exact same `examples/generic-plan/context.json`** — define your team once, clarify many specs.

| Example | Source Input | Language | Size | Demonstrates | Output |
|---|---|---|---|---|---|
| [`generic-plan/`](generic-plan/) | `plan.md` | EN | 4 Qs | Minimal `plan.md` without scenario tables + `mootWhen` | [open-points.html](generic-plan/open-points.html) |
| [`speckit-sso/`](speckit-sso/) | Spec Kit `spec.md` | EN | 5 Qs | `[NEEDS CLARIFICATION]` extraction + 2 independent `mootWhen` branches + reused `context.json` | [open-points.html](speckit-sso/open-points.html) |
| [`openspec-webhooks/`](openspec-webhooks/) | OpenSpec `proposal.md` | EN | 3 Qs | Brownfield delta sign-off before `/opsx:apply` + `PLAT: C` + reused `context.json` | [open-points.html](openspec-webhooks/open-points.html) |
| [`steuerbox/`](steuerbox/) | Anonymised feature-set | DE | 25 topics / 40 Qs | Real enterprise spec with 4 Use Cases, 26 scenarios, wireframes, and full RACI matrix | [`../example.html`](../example.html) |
