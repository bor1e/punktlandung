# Feature Specification: Enterprise SSO Login (`spec.md`)

- **Version:** 0.1.0
- **Source Workflow:** GitHub Spec Kit (`/speckit.specify` → `/speckit.clarify`)
- **Target:** Allow enterprise tenants to sign in via their corporate Identity Provider (IdP).

## User Stories

- As an enterprise employee, I can sign in with my corporate account without creating a separate password.
- As a tenant administrator, I can link my organization's IdP configuration.

## Edge Cases & Open Clarifications

- [NEEDS CLARIFICATION: Should v1 support OIDC only, SAML 2.0 only, or both protocols?]
- [NEEDS CLARIFICATION: If SAML 2.0 is supported, which metadata format and certificate rotation interval do enterprise customers actually use?]
- [NEEDS CLARIFICATION: Should first-time SSO logins create user accounts automatically via Just-in-Time (JIT) provisioning or require pre-invited accounts?]
- [NEEDS CLARIFICATION: If JIT provisioning is enabled, which default role should newly created users receive?]
- [NEEDS CLARIFICATION: When the IdP session expires or is revoked, should our app session end immediately or remain valid until local timeout?]
