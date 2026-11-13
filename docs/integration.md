# Domain and integration

[Documentation index](README.md) · [Repository instructions](../AGENTS.md)

**Status:** This page records the target design from repository instructions and skills. Its behavior has not been verified as implemented in this snapshot.

The tables and rules on this page are **target domain behavior**, not proof of a running service or an approved API. Source: `cw-identity-domain` ([Claude](../.claude/skills/cw-identity-domain/SKILL.md), [Codex](../.codex/skills/cw-identity-domain/SKILL.md)). The linked mockup and guides remain the source for product details; confirm ambiguous values before implementation.

## What this service owns

Who the user is and how they sign in.

**Data**: Users, hashed passwords, MFA factors (authenticator app, security keys, recovery codes), linked accounts (Google, GitHub, Microsoft, GitLab), SAML SSO connections per organization, sessions, personal API tokens, one-time codes and links, profile and preferences (theme, language, density, personal status).

**API**: Sign-in, sign-up, MFA, one-time codes, password reset, sessions (list, revoke), API tokens, profile, preferences. Issues the tokens the gateways verify.

**Events emitted**: `user.signed-up`, `user.email-verified`, `user.status-changed`, `session.revoked`, `api-token.created`, `api-token.revoked`.

**Events consumed**: `member.removed` (closes the user's sessions in that organization).

**External systems**: OAuth providers, customers' SAML identity providers, WebAuthn for security keys.

**Mockup screens**: Main, Inscription, Mfa, Otp, MotDePasseOublie, Reinitialisation, Deconnexion; Compte › Profil, Sécurité, Préférences, Jetons d’API; Organisation › Sécurité et SSO.

## Rules this service guards

- Passwords: 12 characters minimum, no composition rule, refused when found in the embedded list of compromised passwords; strength scored 0 to 4. This decision overrides the mockup, whose password screens still list composition rules.
- Lockout after repeated failures (the mockup shows 15 minutes and "3 tentatives restantes").
- One-time codes expire (10 minutes for sign-in codes, 15 for an email change); resend is throttled (30 s and 45 s in the mockup).
- Recovery codes are shown once and stored hashed; API tokens are shown once.
- Sessions close after 12 hours of inactivity by default.

## Notes

Decided: this service is built in NestJS, without an existing identity provider (Keycloak, Zitadel, Ory). Its security parameters are fixed in the `cw-identity-security` skill. At start-up this service also carries the organizations and members module, extracted later into cadenway-organization-service.

Everything above comes from the [repositories document](https://claude.ai/artifact/BPinmYxoF3mbK8w9BMB43N) and the
[integration guide](https://claude.ai/artifact/CpJHVCiFfF9j3KbHQ2S1Et). If the mockup disagrees with this guide, update the guide and its source skill for both assistants.

## Engineering standards

These skills fix the engineering standards this service follows. They are target conventions, not proof of an implementation in this snapshot.

| Skill                                                                                                                                                | What it fixes                                                                                                                                                                                                                           |
| ---------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `cw-database-conventions` ([Claude](../.claude/skills/cw-database-conventions/SKILL.md), [Codex](../.codex/skills/cw-database-conventions/SKILL.md)) | Plural snake_case tables, `id` from `uuidv7()`, `organization_id` first in tenant indexes, `version`, `timestamptz` dates, `text` with `CHECK` for enumerations, forced row-level security, a pool of 5 connections, timeouts per role. |
| `cw-logging-and-tracing` ([Claude](../.claude/skills/cw-logging-and-tracing/SKILL.md), [Codex](../.codex/skills/cw-logging-and-tracing/SKILL.md))    | JSON logs with fixed fields and masking, W3C `traceparent` over HTTP and NATS, the ESM start-up flags, metrics per route and lag alerts, health and shutdown semantics.                                                                 |
| `cw-jobs` ([Claude](../.claude/skills/cw-jobs/SKILL.md), [Codex](../.codex/skills/cw-jobs/SKILL.md))                                                 | Durable jobs on pg-boss through `@cadenway/nest-jobs`: enqueued in the use case transaction, one key per occurrence, bounded retries, a dead-letter queue.                                                                              |
| `cw-identity-security` ([Claude](../.claude/skills/cw-identity-security/SKILL.md), [Codex](../.codex/skills/cw-identity-security/SKILL.md))          | Opaque sessions, API and internal token formats, argon2id parameters and the password policy, TOTP, WebAuthn, the hardened SAML profile, lockout and code lifetimes.                                                                    |

## Contract and delivery sequence

The `cadenway-api-contracts` repository owns HTTP and event specifications. Consumers use published `@cadenway/contracts` packages and `@cadenway/nest-messaging`; do not redefine payloads or connect to another service's database. Change contracts first, then the producing service, followed by gateways and listeners, and finally the webapp. Planned event names on this page must be checked against the actual published specification before use.

## References

[Interactive mockup](https://claude.ai/artifact/KYRM7AnsYLiBLBLKy8i4HE), [integration guide](https://claude.ai/artifact/CpJHVCiFfF9j3KbHQ2S1Et), and [repositories and packages](https://claude.ai/artifact/BPinmYxoF3mbK8w9BMB43N). Use [AGENTS.md](../AGENTS.md) as the local source for ownership and hard limits.
