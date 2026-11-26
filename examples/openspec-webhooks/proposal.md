# OpenSpec Change Proposal: Signed Webhook Retries (`proposal.md`)

- **Version:** 0.1.0
- **Location in OpenSpec:** `openspec/changes/webhook-retries/proposal.md`
- **Summary:** Add exponential retry + HMAC signing to outbound order webhooks without altering existing webhook payload schemas.

## Open Questions Before `/opsx:apply`

- `WH-1`: Which HMAC signature header format and secret-rotation overlap window do existing webhook consumers expect?
- `WH-2`: How long should failed webhook deliveries retry before moving to dead-letter storage?
- `WH-3`: Should tenant admins see dead-lettered webhook attempts in the UI, or only via support logs in v1?

## Ephemeral Clarification Artifact

When `open === 0` after `merge-answers.mjs`, fold resolved answers into `proposal.md` / delta `spec.md` and delete `spec.json` / `*.html` before archiving the OpenSpec change.
